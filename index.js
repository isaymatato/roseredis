var redis = require('redis');
var deepRef = require('deepref');

function Rose(redisClient, commandDefs) {
  this.redisClient = redisClient;
  this._commands = [];
  this._handlers = [];

  this._registerCommands(commandDefs || []);
}

Rose.prototype._registerCommand = function(self, commandDef) {
  var label = commandDef.label;
  var method = commandDef.method;
  self[label] = function() {
    return self.command(method.apply(self, arguments));
  };
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
  if (typeof callback !== 'function') {
    callback = function() {};
  }
  this._execRedis(function(err, replies) {
    if (err) {
      console.error(err);
      return callback('Something went wrong!');
    }
    var result = self._processReplies(replies);
    callback(null, result);
  });
};

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

  this[label] = function() {
    var callback = arguments[arguments.length - 1];
    var args = Array.prototype.slice.call(arguments, 0, -1);
    var easyRedis = new Rose(redisClient,[commandDef]);
    easyRedis[label]
      .apply(this, args)
      .exec(callback);
  };
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
  for (var label in data) {
    this._registerCommandSingle({
      label: label,
      method: data[label]
    });
  }
};

module.exports = {
  createClient: function(redisClient) {
    return new Client(redisClient);
  }
};
