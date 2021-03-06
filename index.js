var redis = require('redis');
var deepRef = require('deepref');
var flatten = require('flat');

function Rose(redisClient, commandDefs) {
  this.redisClient = redisClient;
  this._commands = [];
  this._handlers = [];

  this._registerCommands(commandDefs || []);
}

Rose.prototype._registerCommand = function(self, commandDef) {
  var label = commandDef.label;
  var method = commandDef.method;
  var command = function() {
    return self.command(method.apply(self, arguments));
  };

  deepRef.set(self, label, command);
};

Rose.prototype._registerCommands = function(commandDefs) {
  var self = this;
  commandDefs.forEach(function(def) {
    self._registerCommand(self, def);
  });
};

// Handlers must by synchronous!!!
Rose.prototype.command = function(data) {
  if (!data) {
    console.error('Missing data!');
    return this;
  }
  this._commands.push(data.command || data);
  this._handlers.push(data.handler || null);
  return this;
};

Rose.prototype._execRedis = function(callback) {
  // Nothing to do, no commands sent
  if (!this._commands || this._commands.length < 1) {
    return callback(null);
  }
  var multi = this.redisClient.multi(this._commands);
  multi.exec(callback);
};

Rose.prototype._processReplies = function(replies) {
  var result = {};
  deepRef.decorate(result);
  var self = this;
  replies = replies || [];
  replies.forEach(function(reply, index) {
    var handler = self._handlers[index];
    if (handler) {
      handler(reply, result);
    }
  });
  deepRef.undecorate(result);
  return result;
};

Rose.prototype.exec = function(callback) {
  var self = this;
  var promise = new Promise(function(resolve, reject) {
    self._execRedis(function(err, replies) {
      if (err) {
        console.error(err);
        reject('Error executing redis command!');
      }
      var result = self._processReplies(replies);
      resolve(result);
    });
  });

  if (typeof callback === 'function') {
    unpromisify(promise, callback);
  }

  return promise;
};

function unpromisify(promise, callback) {
  promise.then(function(result) {
    callback(null, result);
  })
  .catch(function(error) {
    callback(error);
  });
}

function Client(redisClient) {
  this.redisClient = redisClient;
  if (!this.redisClient) {
    this.redisClient = redis.createClient();
  }
  this.commandDefs = [];
}

Client.prototype.multi = function() {
  var multi = new Rose(this.redisClient,this.commandDefs);
  return multi;
};

Client.prototype._registerCommandSingle = function(commandDef) {
  this.commandDefs.push(commandDef);

  var label = commandDef.label;
  var redisClient = this.redisClient;
  var def = {
    label: 'single',
    method: commandDef.method
  };
  var command = function() {
    var callback = arguments[arguments.length - 1];
    var args = Array.prototype.slice.call(arguments, 0, -1);
    if (typeof callback !== 'function') {
      args.push(callback);
    }

    var rose = new Rose(redisClient,[def]);
    return rose[def.label]
      .apply(this, args)
      .exec(callback);
  };

  deepRef.set(this, label, command);
};

Client.prototype.registerCommand = function(label, method) {
  var commandDef = {
    label: label,
    method: method
  };
  return this._registerCommandSingle(commandDef);
};

// Data should be a key:val object
//   with key as the command label, and val as the method
Client.prototype.registerCommands = function(data) {
  data = flatten(data);
  for (var label in data) {
    this._registerCommandSingle({
      label: label,
      method: data[label]
    });
  }
};

Client.prototype.createClient = function() {
  var client = new Client(this.redisClient);
  this.commandDefs.forEach(function(def) {
    client._registerCommandSingle(def);
  });
  return client;
};

module.exports = {
  createClient: function(redisClient) {
    return new Client(redisClient);
  }
};
