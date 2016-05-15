roseredis
=========

Easy to use abstraction layer for node_redis

## Installation
  ```
  npm install roseredis --save
  ```

## Usage Example

  ```javascript
  var rose = require('roseredis');
  var roseClient = rose.createClient();

  var redisKey = {
    foo: 'fooKey',
    bar: 'barKey'
  };

  var commands = {
    setFoo:
    function(value) {
      return ['set',redisKey.foo,value];
    },
    getFoo:
    function() {
      return {
        command: ['get',redisKey.foo],
        handler: function(reply) {
          return rose.setKey('fooResult', reply);
        }
      };
    },
    setBar:
    function(value) {
      return ['set',redisKey.bar,value];
    },
    getBar:
    function() {
      return {
        command: ['get',redisKey.bar],
        handler: function(reply) {
          var parsed = parseInt(reply) || 0;
          return rose.setKey('barResult', parsed);
        }
      };
    },
  };

  roseClient.registerCommands(commands);

  roseClient.multi()
    .setFoo('Foo is set to this')
    .setBar(123456)
    .getFoo()
    .getBar()
    .exec(function(err, result) {
      console.log(result.fooResult);
      // Foo is set to this
      console.log(result.barResult, typeof result.barResult);
      // 123456 'number'
    });

  ```
## Creating commands

Rose commands are methods that return a redis command array and optional reply handler.

```javascript
function getFoo() {
  return {
    command: ['get', 'fooKey'],
    handler: function(reply) {
      return rose.setKey('fooResult', reply);
    }
  };
}
```
Command is the redis command array.  
(This gets the value stored at redis key 'fooKey')
```javascript
command: ['get', 'fooKey'],
```
Handler wraps the reply from redis.  
rose.setKey(key, value) tells rose to set result.key to value
```javascript
handler: function(reply) {
  return rose.setKey('fooResult', reply);
}
```

You can optionally return just the redis command if you're not doing anything with the redis reply.  
(This is common for setters)
```javascript
function setFoo(value) {
  return ['set', 'fooKey', value];
}
```

You can use the handler to provide additional formatting of the data, such as parsing values from the reply.
```javascript
handler: function(reply) {
  var parsed = parseInt(reply) || 0;
  return rose.setKey('barResult', parsed);
}
```

Rose uses deepref, which allows you to set nested fields in the result
```javascript
handler: function(reply) {
  return rose.setKey('a.b.c', reply);
}
// The result will be { a: { b: { c: <reply> } } }
```
See here for full documentation on deepref  
https://github.com/isaymatato/deepref#readme


## Registering commands
Once created, you'll need to register commands with the rose client.

This can be done one at a time, using client.registerCommand(label, method);
```javascript
function setFoo(value) {
  return ['set', 'fooKey', value];
}

roseClient.registerCommand('setFoo', setFoo);
```

Or, more typically, you can use registerCommands to register all the commands defined in an object
```javascript
var commands = {
  setFoo:
  function(value) {
    return ['set',redisKey.foo,value];
  },
  getFoo:
  function() {
    return {
      command: ['get',redisKey.foo],
      handler: function(reply) {
        return rose.setKey('fooResult', reply);
      }
    };
  }
};
roseClient.registerCommands(commands);
```

## Tests
  ```
  npm test
  ```

## Contributing

Please use the included style guide.  If you change anything, please test
and add unit tests for any new functionality.  If you're fixing a bug, please
add a unit test that would have failed before the bug was fixed.  Thanks!