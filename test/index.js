var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var should = chai.should();
var rose = require('../index');
var createClient = rose.createClient;

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
        handler: function(reply, result) {
          result.test = reply;
        }
      };
    },
    deepGetTest:
    function() {
      return {
        command: ['get',testKey],
        handler: function(reply, result) {
          result.setKey('testDeep.a.b', reply);
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
      function testCommand() {};
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

      it('Client should be able to set and retrieve value', function(done) {
        var randomValue = '' + Math.random();
        myClient.setTest(randomValue, function() {
          myClient.getTest(function(err, result) {
            should.not.exist(err);
            result.test.should.equal(randomValue);
            done();
          });
        });
      });

      it('Result should be able to deepset using setKey', function(done) {
        var randomValue = '' + Math.random();
        myClient.setTest(randomValue, function() {
          myClient.deepGetTest(function(err, result) {
            should.not.exist(err);
            result.testDeep.a.b.should.equal(randomValue);
            expect(result.setKey).to.not.be.a('function');
            done();
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

      it('Multi should be able to set and retrieve value', function(done) {
        var randomValue = '' + Math.random();
        multi
          .delTest()
          .setTest(randomValue)
          .getTest()
          .delTest()
          .exec(function(err, result) {
            should.not.exist(err);
            result.test.should.equal(randomValue);
            done();
          });
      });

      it('Multi result should be able to deepset using setKey', function(done) {
        var randomValue = '' + Math.random();
        multi
          .delTest()
          .setTest(randomValue)
          .deepGetTest()
          .delTest()
          .exec(function(err, result) {
            should.not.exist(err);
            result.testDeep.a.b.should.equal(randomValue);
            expect(result.setKey).to.not.be.a('function');
            done();
          });
      });

    });
  });
});