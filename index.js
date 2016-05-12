var deepSet = require('deepref').set;

function EasyRedis(redisClient, commandDefs) {
  this.redisClient = redisClient;
  this._commands = [];
  this._handlers = [];

  this._registerCommands(commandDefs || []);
}

EasyRedis.prototype._registerCommand = function(self, commandDef) {
  var label = commandDef.label;
  var method = commandDef.method;
  self[label] = function() {
    return self.command(method.apply(self, arguments));
  };
};

EasyRedis.prototype._registerCommands = function(commandDefs) {
  var self = this;
  commandDefs.forEach(function(def) {
    self._registerCommand(self, def);
  });
};

// Handlers must by synchronous!!!
EasyRedis.prototype.command = function(data) {
  if (!data) {
    console.error('Missing data!');
    return this;
  }
  this._commands.push(data.command || data);
  this._handlers.push(data.handler || null);
  return this;
};

EasyRedis.prototype._execRedis = function(callback) {
  // Nothing to do, no commands sent
  if (!this._commands || this._commands.length < 1) {
    return callback(null);
  }
  var multi = this.redisClient.multi(this._commands);
  multi.exec(callback);
};

EasyRedis.prototype._handleResponse = function(response) {
  response = response || {};
  var self = this;
  var data, i;
  // Setter
  if (response.$set) {
    data = response.$set;
    for (i in data) {
      deepSet(self.result, i, data[i]);
    }
  }

  // Increment
  if (response.$inc) {
    data = response.$inc;
    for (i in data) {
      deepInc(self.result, i, data[i]);
    }
  }
};

EasyRedis.prototype._processReplies = function(replies) {
  this.result = {};
  var self = this;
  replies = replies || [];
  replies.forEach(function(reply, index) {
    var handler = self._handlers[index];
    if (handler) {
      self._handleResponse(handler(reply));
    }
  });
  return this.result;
};

EasyRedis.prototype.exec = function(callback) {
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

function returnSetKey(key, value) {
  var data = {};
  data[key] = value;
  return {
    $set: data
  };
}

function Client(redisClient) {
  this.redisClient = redisClient;
  this.commandDefs = [];
}

Client.prototype.multi = function() {
  var multi = new EasyRedis(this.redisClient,this.commandDefs);
  return multi;
};

Client.prototype._registerCommandSingle = function(commandDef) {
  this.commandDefs.push(commandDef);

  var label = commandDef.label;
  var redisClient = this.redisClient;
  this[label] = function() {
    var callback = arguments[arguments.length - 1];
    var args = Array.prototype.slice.call(arguments, 0, -1);
    var easyRedis = new EasyRedis(redisClient,[commandDef]);
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

Client.prototype.setKey = returnSetKey;

module.exports = {
  client: function(redisClient) {
    return new Client(redisClient);
  },
  setKey: returnSetKey
};
