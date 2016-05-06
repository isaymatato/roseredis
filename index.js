function mapKeys(parent, pointer) {
  Object.keys(pointer).forEach(function(key) {
    parent.pointer[ parent.field ][key] = pointer[key];
  });
}

function deepReference(object, path) {
  path = path.split('.');
  var field;
  var intField;
  var pointer = object;
  var parent = null;
  for (var i = 0; i < path.length; i += 1) {
    field = path[i];
    intField = parseInt(field);

    if (!isNaN(intField)) {
      // Field is an integer
      field = intField;

      // Convert current obj to array if it isn't one already
      if (!Array.isArray(pointer) &&
          parent) {
        parent.pointer[ parent.field ] = [];
        mapKeys(parent, pointer);
        pointer = parent.pointer[ parent.field ];
      }
    }

    if (typeof pointer[field] !== 'object') {
      pointer[field] = {};
    }
    parent = {
      pointer: pointer,
      field: field
    };
    if (i < path.length - 1) {
      pointer = pointer[field];
    }
  }
  return {
    pointer: pointer,
    field: field
  };
}

function deepSet(object, path, value) {
  var deep = deepReference(object, path);
  deep.pointer[deep.field] = value;
}

function deepInc(object, path, delta) {
  var deep = deepReference(object, path);
  if (typeof deep.pointer[deep.field] !== 'number') {
    deep.pointer[deep.field] = 0;
  }
  deep.pointer[deep.field] += delta;
}

function RoseRedis(redisClient, commandDefs) {
  this.redisClient = redisClient;
  this._commands = [];
  this._handlers = [];

  this._registerCommands(commandDefs || []);
}

RoseRedis.prototype._registerCommand = function(self, commandDef) {
  var label = commandDef.label;
  var method = commandDef.method;
  self[label] = function() {
    return self.command(method.apply(self, arguments));
  };
};

RoseRedis.prototype._registerCommands = function(commandDefs) {
  var self = this;
  commandDefs.forEach(function(def) {
    self._registerCommand(self, def);
  });
};

// Handlers must by synchronous!!!
RoseRedis.prototype.command = function(data) {
  this._commands.push(data.command || data);
  this._handlers.push(data.handler || null);
  return this;
};

RoseRedis.prototype._execRedis = function(callback) {
  var multi = this.redisClient.multi(this._commands);
  multi.exec(callback);
};

RoseRedis.prototype._handleResponse = function(response) {
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

RoseRedis.prototype._processReplies = function(replies) {
  this.result = {};
  var self = this;
  replies.forEach(function(reply, index) {
    var handler = self._handlers[index];
    if (handler) {
      self._handleResponse(handler(reply));
    }
  });
  return this.result;
};

RoseRedis.prototype.exec = function(callback) {
  var self = this;
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
  var multi = new RoseRedis(this.redisClient,this.commandDefs);
  return multi;
};

Client.prototype._registerCommandSingle = function(commandDef) {
  this.commandDefs.push(commandDef);

  var label = commandDef.label;
  var redisClient = this.redisClient;
  this[label] = function() {
    var callback = arguments[arguments.length - 1];
    var args = Array.prototype.slice.call(arguments, 0, -1);
    var easyRedis = new RoseRedis(redisClient,[commandDef]);
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
