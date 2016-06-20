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

      it('Nested commands get appended to client and multi', function() {
        myClient.registerCommands({
          a: {
            b: {
              c: function() { return []; }
            }
          }
        });
        expect(myClient.a.b.c).to.be.a('function');

        var multi = myClient.multi();
        expect(multi.a.b.c).to.be.a('function');
        var multi2 = multi.a.b.c();
        expect(multi2.a.b.c).to.be.a('function');
        expect(multi2.exec).to.be.a('function');
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

      it('Command should return promise', function(done) {
        var randomValue = '' + Math.random();

        myClient.setTest(randomValue)
        .then(function() {
          return myClient.getTest();
        })
        .then(function(result) {
          result.test.should.equal(randomValue);
          done();
        })
        .catch(function(error) {
          done(error);
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

    describe('#createClient', function() {
      it('should be a function', function() {
        expect(myClient.createClient).to.be.a('function');
      });
      var childClient;
      it('should create an object', function() {
        childClient = myClient.createClient();
        expect(childClient).to.be.a('object');
      });

      it('should register inherited parent commands', function() {
        myClient.registerCommand('testParentCommand', function() {});

        childClient = myClient.createClient();
        childClient.registerCommand('testChildCommand', function() {});

        expect(myClient.testParentCommand).to.be.a('function');
        expect(myClient.testChildCommand).to.not.be.a('function');

        expect(childClient.testParentCommand).to.be.a('function');
        expect(childClient.testChildCommand).to.be.a('function');
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

      it('Multi.exec should return a promise', function(done) {
        var randomValue = '' + Math.random();
        multi
          .delTest()
          .setTest(randomValue)
          .getTest()
          .delTest()
          .exec()
          .then(function(result) {
            result.test.should.equal(randomValue);
            done();
          })
          .catch(function(error) {
            done(error);
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