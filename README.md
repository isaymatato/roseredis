roseredis
=========

Easy to use abstraction layer for node_redis

## Installation
  ```
  npm install roseredis --save
  ```

## Usage

  ```javascript
  var rose = require('./index.js');
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

## Tests
  ```
  npm test
  ```

## Contributing

Please use the included style guide.  If you change anything, please test
and add unit tests for any new functionality.  If you're fixing a bug, please
add a unit test that would have failed before the bug was fixed.  Thanks!