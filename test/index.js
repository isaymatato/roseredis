var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var rose = require('../index');
var setKey = rose.setKey;
var createClient = rose.createClient;

describe('#setKey', function() {
  it('Throws error if missing a key', function() {
    expect(function(){
      setKey(undefined, 'x');
    }).to.throw('setKey: key must be a string');
  });
  it('Throws error if missing a value', function() {
    expect(function(){
      setKey('x', undefined);
    }).to.throw('setKey: value is undefined');
  });

  it('Returns structure of {$set: {key:value}}', function() {
    var result = setKey('keyName','value');
    var json = JSON.stringify(result);
    json.should.equal('{"$set":{"keyName":"value"}}');
  });
});

describe('#createClient', function() {
  var myClient;

  var testKey = 'roseTest';

  var commands = {
    setTest:
    function(value) {
      return ['set',testKey,value];
    },
    getTest:
    function() {
      return {
        command: ['get',testKey],
        handler: function(reply) {
          return rose.setKey('test', reply);
        }
      };
    },
    delTest:
    function() {
      return ['del',testKey];
    },
  };

  it('Returns an object', function() {
    myClient = createClient();
    var type = typeof myClient;
    type.should.equal('object');
  });

  describe('#client', function() {
    describe('#registerCommand', function() {
      function testCommand(){};
      var key = 'testCommand';
      it('Registered command gets appended to client', function() {
        myClient.registerCommand(key, testCommand);
        var type = typeof myClient[key];
        type.should.equal('function');
      });
    });

    describe('#registerCommands', function() {
      it('Registered commands get appended to client', function() {
        myClient.registerCommands(commands);
        var keys = Object.keys(commands);
        keys.forEach(function(key) {
          var type = typeof myClient[key];
          type.should.equal('function');
        });
      });

      it('Client should be able to set and retrieve value', function() {
        var randomValue = '' + Math.random();
        myClient.setTest(randomValue, function() {
          myClient.getTest(function(err, result) {
            err.should.equal(null);
            result.test.should.equal(randomValue);
          });
        });
      });
    });

    describe('#multi', function() {

      var multi;
      it('client.multi() should return object', function() {
        multi = myClient.multi();
        var type = typeof multi;
        type.should.equal('object');
      });


      it('Registered commands get appended to multi', function() {
        var keys = Object.keys(commands);
        keys.forEach(function(key) {
          var type = typeof multi[key];
          type.should.equal('function');
        });
      });

      it('Multi should be able to set and retrieve value', function() {
        var randomValue = '' + Math.random();
        multi
          .delTest()
          .setTest(randomValue)
          .getTest()
          .delTest()
          .exec(function(err, result) {
            err.should.equal(null);
            result.test.should.equal(randomValue);
          });
      });

    });
  });
});