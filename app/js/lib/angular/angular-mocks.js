
angular.mock = {};


angular.mock.$BrowserProvider = function() {
  this.$get = function(){
    return new angular.mock.$Browser();
  };
};

angular.mock.$Browser = function() {
  var self = this;

  this.isMock = true;
  self.$$url = "http://server/";
  self.$$lastUrl = self.$$url; // used by url polling fn
  self.pollFns = [];

  self.$$completeOutstandingRequest = angular.noop;
  self.$$incOutstandingRequestCount = angular.noop;



  self.onUrlChange = function(listener) {
    self.pollFns.push(
      function() {
        if (self.$$lastUrl != self.$$url) {
          self.$$lastUrl = self.$$url;
          listener(self.$$url);
        }
      }
    );

    return listener;
  };

  self.cookieHash = {};
  self.lastCookieHash = {};
  self.deferredFns = [];
  self.deferredNextId = 0;

  self.defer = function(fn, delay) {
    delay = delay || 0;
    self.deferredFns.push({time:(self.defer.now + delay), fn:fn, id: self.deferredNextId});
    self.deferredFns.sort(function(a,b){ return a.time - b.time;});
    return self.deferredNextId++;
  };


  self.defer.now = 0;


  self.defer.cancel = function(deferId) {
    var fnIndex;

    angular.forEach(self.deferredFns, function(fn, index) {
      if (fn.id === deferId) fnIndex = index;
    });

    if (fnIndex !== undefined) {
      self.deferredFns.splice(fnIndex, 1);
      return true;
    }

    return false;
  };


  self.defer.flush = function(delay) {
    if (angular.isDefined(delay)) {
      self.defer.now += delay;
    } else {
      if (self.deferredFns.length) {
        self.defer.now = self.deferredFns[self.deferredFns.length-1].time;
      } else {
        throw Error('No deferred tasks to be flushed');
      }
    }

    while (self.deferredFns.length && self.deferredFns[0].time <= self.defer.now) {
      self.deferredFns.shift().fn();
    }
  };

  self.$$baseHref = '';
  self.baseHref = function() {
    return this.$$baseHref;
  };
};
angular.mock.$Browser.prototype = {


  poll: function poll() {
    angular.forEach(this.pollFns, function(pollFn){
      pollFn();
    });
  },

  addPollFn: function(pollFn) {
    this.pollFns.push(pollFn);
    return pollFn;
  },

  url: function(url, replace) {
    if (url) {
      this.$$url = url;
      return this;
    }

    return this.$$url;
  },

  cookies:  function(name, value) {
    if (name) {
      if (value == undefined) {
        delete this.cookieHash[name];
      } else {
        if (angular.isString(value) &&       //strings only
            value.length <= 4096) {          //strict cookie storage limits
          this.cookieHash[name] = value;
        }
      }
    } else {
      if (!angular.equals(this.cookieHash, this.lastCookieHash)) {
        this.lastCookieHash = angular.copy(this.cookieHash);
        this.cookieHash = angular.copy(this.cookieHash);
      }
      return this.cookieHash;
    }
  },

  notifyWhenNoOutstandingRequests: function(fn) {
    fn();
  }
};




angular.mock.$ExceptionHandlerProvider = function() {
  var handler;

  
  this.mode = function(mode) {
    switch(mode) {
      case 'rethrow':
        handler = function(e) {
          throw e;
        };
        break;
      case 'log':
        var errors = [];

        handler = function(e) {
          if (arguments.length == 1) {
            errors.push(e);
          } else {
            errors.push([].slice.call(arguments, 0));
          }
        };

        handler.errors = errors;
        break;
      default:
        throw Error("Unknown mode '" + mode + "', only 'log'/'rethrow' modes are allowed!");
    }
  };

  this.$get = function() {
    return handler;
  };

  this.mode('rethrow');
};



angular.mock.$LogProvider = function() {

  function concat(array1, array2, index) {
    return array1.concat(Array.prototype.slice.call(array2, index));
  }


  this.$get = function () {
    var $log = {
      log: function() { $log.log.logs.push(concat([], arguments, 0)); },
      warn: function() { $log.warn.logs.push(concat([], arguments, 0)); },
      info: function() { $log.info.logs.push(concat([], arguments, 0)); },
      error: function() { $log.error.logs.push(concat([], arguments, 0)); }
    };

    
    $log.reset = function () {
      
      $log.log.logs = [];
      
      $log.warn.logs = [];
      
      $log.info.logs = [];
      
      $log.error.logs = [];
    };

    
    $log.assertEmpty = function() {
      var errors = [];
      angular.forEach(['error', 'warn', 'info', 'log'], function(logLevel) {
        angular.forEach($log[logLevel].logs, function(log) {
          angular.forEach(log, function (logItem) {
            errors.push('MOCK $log (' + logLevel + '): ' + String(logItem) + '\n' + (logItem.stack || ''));
          });
        });
      });
      if (errors.length) {
        errors.unshift("Expected $log to be empty! Either a message was logged unexpectedly, or an expected " +
          "log message was not checked and removed:");
        errors.push('');
        throw new Error(errors.join('\n---------\n'));
      }
    };

    $log.reset();
    return $log;
  };
};


(function() {
  var R_ISO8061_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?:\:?(\d\d)(?:\:?(\d\d)(?:\.(\d{3}))?)?)?(Z|([+-])(\d\d):?(\d\d)))?$/;

  function jsonStringToDate(string){
    var match;
    if (match = string.match(R_ISO8061_STR)) {
      var date = new Date(0),
          tzHour = 0,
          tzMin  = 0;
      if (match[9]) {
        tzHour = int(match[9] + match[10]);
        tzMin = int(match[9] + match[11]);
      }
      date.setUTCFullYear(int(match[1]), int(match[2]) - 1, int(match[3]));
      date.setUTCHours(int(match[4]||0) - tzHour, int(match[5]||0) - tzMin, int(match[6]||0), int(match[7]||0));
      return date;
    }
    return string;
  }

  function int(str) {
    return parseInt(str, 10);
  }

  function padNumber(num, digits, trim) {
    var neg = '';
    if (num < 0) {
      neg =  '-';
      num = -num;
    }
    num = '' + num;
    while(num.length < digits) num = '0' + num;
    if (trim)
      num = num.substr(num.length - digits);
    return neg + num;
  }


  angular.mock.TzDate = function (offset, timestamp) {
    var self = new Date(0);
    if (angular.isString(timestamp)) {
      var tsStr = timestamp;

      self.origDate = jsonStringToDate(timestamp);

      timestamp = self.origDate.getTime();
      if (isNaN(timestamp))
        throw {
          name: "Illegal Argument",
          message: "Arg '" + tsStr + "' passed into TzDate constructor is not a valid date string"
        };
    } else {
      self.origDate = new Date(timestamp);
    }

    var localOffset = new Date(timestamp).getTimezoneOffset();
    self.offsetDiff = localOffset*60*1000 - offset*1000*60*60;
    self.date = new Date(timestamp + self.offsetDiff);

    self.getTime = function() {
      return self.date.getTime() - self.offsetDiff;
    };

    self.toLocaleDateString = function() {
      return self.date.toLocaleDateString();
    };

    self.getFullYear = function() {
      return self.date.getFullYear();
    };

    self.getMonth = function() {
      return self.date.getMonth();
    };

    self.getDate = function() {
      return self.date.getDate();
    };

    self.getHours = function() {
      return self.date.getHours();
    };

    self.getMinutes = function() {
      return self.date.getMinutes();
    };

    self.getSeconds = function() {
      return self.date.getSeconds();
    };

    self.getTimezoneOffset = function() {
      return offset * 60;
    };

    self.getUTCFullYear = function() {
      return self.origDate.getUTCFullYear();
    };

    self.getUTCMonth = function() {
      return self.origDate.getUTCMonth();
    };

    self.getUTCDate = function() {
      return self.origDate.getUTCDate();
    };

    self.getUTCHours = function() {
      return self.origDate.getUTCHours();
    };

    self.getUTCMinutes = function() {
      return self.origDate.getUTCMinutes();
    };

    self.getUTCSeconds = function() {
      return self.origDate.getUTCSeconds();
    };

    self.getUTCMilliseconds = function() {
      return self.origDate.getUTCMilliseconds();
    };

    self.getDay = function() {
      return self.date.getDay();
    };

    if (self.toISOString) {
      self.toISOString = function() {
        return padNumber(self.origDate.getUTCFullYear(), 4) + '-' +
              padNumber(self.origDate.getUTCMonth() + 1, 2) + '-' +
              padNumber(self.origDate.getUTCDate(), 2) + 'T' +
              padNumber(self.origDate.getUTCHours(), 2) + ':' +
              padNumber(self.origDate.getUTCMinutes(), 2) + ':' +
              padNumber(self.origDate.getUTCSeconds(), 2) + '.' +
              padNumber(self.origDate.getUTCMilliseconds(), 3) + 'Z'
      }
    }

    var unimplementedMethods = ['getMilliseconds', 'getUTCDay',
        'getYear', 'setDate', 'setFullYear', 'setHours', 'setMilliseconds',
        'setMinutes', 'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear',
        'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth', 'setUTCSeconds',
        'setYear', 'toDateString', 'toGMTString', 'toJSON', 'toLocaleFormat', 'toLocaleString',
        'toLocaleTimeString', 'toSource', 'toString', 'toTimeString', 'toUTCString', 'valueOf'];

    angular.forEach(unimplementedMethods, function(methodName) {
      self[methodName] = function() {
        throw Error("Method '" + methodName + "' is not implemented in the TzDate mock");
      };
    });

    return self;
  };

  angular.mock.TzDate.prototype = Date.prototype;
})();


angular.mock.dump = function(object) {
  return serialize(object);

  function serialize(object) {
    var out;

    if (angular.isElement(object)) {
      object = angular.element(object);
      out = angular.element('<div></div>');
      angular.forEach(object, function(element) {
        out.append(angular.element(element).clone());
      });
      out = out.html();
    } else if (angular.isArray(object)) {
      out = [];
      angular.forEach(object, function(o) {
        out.push(serialize(o));
      });
      out = '[ ' + out.join(', ') + ' ]';
    } else if (angular.isObject(object)) {
      if (angular.isFunction(object.$eval) && angular.isFunction(object.$apply)) {
        out = serializeScope(object);
      } else if (object instanceof Error) {
        out = object.stack || ('' + object.name + ': ' + object.message);
      } else {
        out = angular.toJson(object, true);
      }
    } else {
      out = String(object);
    }

    return out;
  }

  function serializeScope(scope, offset) {
    offset = offset ||  '  ';
    var log = [offset + 'Scope(' + scope.$id + '): {'];
    for ( var key in scope ) {
      if (scope.hasOwnProperty(key) && !key.match(/^(\$|this)/)) {
        log.push('  ' + key + ': ' + angular.toJson(scope[key]));
      }
    }
    var child = scope.$$childHead;
    while(child) {
      log.push(serializeScope(child, offset + '  '));
      child = child.$$nextSibling;
    }
    log.push('}');
    return log.join('\n' + offset);
  }
};


angular.mock.$HttpBackendProvider = function() {
  this.$get = [createHttpBackendMock];
};

function createHttpBackendMock($delegate, $browser) {
  var definitions = [],
      expectations = [],
      responses = [],
      responsesPush = angular.bind(responses, responses.push);

  function createResponse(status, data, headers) {
    if (angular.isFunction(status)) return status;

    return function() {
      return angular.isNumber(status)
          ? [status, data, headers]
          : [200, status, data];
    };
  }

  function $httpBackend(method, url, data, callback, headers) {
    var xhr = new MockXhr(),
        expectation = expectations[0],
        wasExpected = false;

    function prettyPrint(data) {
      return (angular.isString(data) || angular.isFunction(data) || data instanceof RegExp)
          ? data
          : angular.toJson(data);
    }

    if (expectation && expectation.match(method, url)) {
      if (!expectation.matchData(data))
        throw Error('Expected ' + expectation + ' with different data\n' +
            'EXPECTED: ' + prettyPrint(expectation.data) + '\nGOT:      ' + data);

      if (!expectation.matchHeaders(headers))
        throw Error('Expected ' + expectation + ' with different headers\n' +
            'EXPECTED: ' + prettyPrint(expectation.headers) + '\nGOT:      ' +
            prettyPrint(headers));

      expectations.shift();

      if (expectation.response) {
        responses.push(function() {
          var response = expectation.response(method, url, data, headers);
          xhr.$$respHeaders = response[2];
          callback(response[0], response[1], xhr.getAllResponseHeaders());
        });
        return;
      }
      wasExpected = true;
    }

    var i = -1, definition;
    while ((definition = definitions[++i])) {
      if (definition.match(method, url, data, headers || {})) {
        if (definition.response) {
          // if $browser specified, we do auto flush all requests
          ($browser ? $browser.defer : responsesPush)(function() {
            var response = definition.response(method, url, data, headers);
            xhr.$$respHeaders = response[2];
            callback(response[0], response[1], xhr.getAllResponseHeaders());
          });
        } else if (definition.passThrough) {
          $delegate(method, url, data, callback, headers);
        } else throw Error('No response defined !');
        return;
      }
    }
    throw wasExpected ?
        Error('No response defined !') :
        Error('Unexpected request: ' + method + ' ' + url + '\n' +
              (expectation ? 'Expected ' + expectation : 'No more request expected'));
  }


  $httpBackend.when = function(method, url, data, headers) {
    var definition = new MockHttpExpectation(method, url, data, headers),
        chain = {
          respond: function(status, data, headers) {
            definition.response = createResponse(status, data, headers);
          }
        };

    if ($browser) {
      chain.passThrough = function() {
        definition.passThrough = true;
      };
    }

    definitions.push(definition);
    return chain;
  };

  
  createShortMethods('when');


  
  $httpBackend.expect = function(method, url, data, headers) {
    var expectation = new MockHttpExpectation(method, url, data, headers);
    expectations.push(expectation);
    return {
      respond: function(status, data, headers) {
        expectation.response = createResponse(status, data, headers);
      }
    };
  };


 
  createShortMethods('expect');


  /**
   * @ngdoc method
   * @name ngMock.$httpBackend#flush
   * @methodOf ngMock.$httpBackend
   * @description
   * Flushes all pending requests using the trained responses.
   *
   * @param {number=} count Number of responses to flush (in the order they arrived). If undefined,
   *   all pending requests will be flushed. If there are no pending requests when the flush method
   *   is called an exception is thrown (as this typically a sign of programming error).
   */
  $httpBackend.flush = function(count) {
    if (!responses.length) throw Error('No pending request to flush !');

    if (angular.isDefined(count)) {
      while (count--) {
        if (!responses.length) throw Error('No more pending request to flush !');
        responses.shift()();
      }
    } else {
      while (responses.length) {
        responses.shift()();
      }
    }
    $httpBackend.verifyNoOutstandingExpectation();
  };


  $httpBackend.verifyNoOutstandingExpectation = function() {
    if (expectations.length) {
      throw Error('Unsatisfied requests: ' + expectations.join(', '));
    }
  };


  $httpBackend.verifyNoOutstandingRequest = function() {
    if (responses.length) {
      throw Error('Unflushed requests: ' + responses.length);
    }
  };


  $httpBackend.resetExpectations = function() {
    expectations.length = 0;
    responses.length = 0;
  };

  return $httpBackend;


  function createShortMethods(prefix) {
    angular.forEach(['GET', 'DELETE', 'JSONP'], function(method) {
     $httpBackend[prefix + method] = function(url, headers) {
       return $httpBackend[prefix](method, url, undefined, headers)
     }
    });

    angular.forEach(['PUT', 'POST', 'PATCH'], function(method) {
      $httpBackend[prefix + method] = function(url, data, headers) {
        return $httpBackend[prefix](method, url, data, headers)
      }
    });
  }
}

function MockHttpExpectation(method, url, data, headers) {

  this.data = data;
  this.headers = headers;

  this.match = function(m, u, d, h) {
    if (method != m) return false;
    if (!this.matchUrl(u)) return false;
    if (angular.isDefined(d) && !this.matchData(d)) return false;
    if (angular.isDefined(h) && !this.matchHeaders(h)) return false;
    return true;
  };

  this.matchUrl = function(u) {
    if (!url) return true;
    if (angular.isFunction(url.test)) return url.test(u);
    return url == u;
  };

  this.matchHeaders = function(h) {
    if (angular.isUndefined(headers)) return true;
    if (angular.isFunction(headers)) return headers(h);
    return angular.equals(headers, h);
  };

  this.matchData = function(d) {
    if (angular.isUndefined(data)) return true;
    if (data && angular.isFunction(data.test)) return data.test(d);
    if (data && !angular.isString(data)) return angular.toJson(data) == d;
    return data == d;
  };

  this.toString = function() {
    return method + ' ' + url;
  };
}

function MockXhr() {

  MockXhr.$$lastInstance = this;

  this.open = function(method, url, async) {
    this.$$method = method;
    this.$$url = url;
    this.$$async = async;
    this.$$reqHeaders = {};
    this.$$respHeaders = {};
  };

  this.send = function(data) {
    this.$$data = data;
  };

  this.setRequestHeader = function(key, value) {
    this.$$reqHeaders[key] = value;
  };

  this.getResponseHeader = function(name) {
    var header = this.$$respHeaders[name];
    if (header) return header;

    name = angular.lowercase(name);
    header = this.$$respHeaders[name];
    if (header) return header;

    header = undefined;
    angular.forEach(this.$$respHeaders, function(headerVal, headerName) {
      if (!header && angular.lowercase(headerName) == name) header = headerVal;
    });
    return header;
  };

  this.getAllResponseHeaders = function() {
    var lines = [];

    angular.forEach(this.$$respHeaders, function(value, key) {
      lines.push(key + ': ' + value);
    });
    return lines.join('\n');
  };

  this.abort = angular.noop;
}



angular.mock.$RootElementProvider = function() {
  this.$get = function() {
    return angular.element('<div ng-app></div>');
  }
};


angular.module('ngMock', ['ng']).provider({
  $browser: angular.mock.$BrowserProvider,
  $exceptionHandler: angular.mock.$ExceptionHandlerProvider,
  $log: angular.mock.$LogProvider,
  $httpBackend: angular.mock.$HttpBackendProvider,
  $rootElement: angular.mock.$RootElementProvider
}).config(function($provide) {
  $provide.decorator('$timeout', function($delegate, $browser) {
    $delegate.flush = function() {
      $browser.defer.flush();
    };
    return $delegate;
  });
});



angular.module('ngMockE2E', ['ng']).config(function($provide) {
  $provide.decorator('$httpBackend', angular.mock.e2e.$httpBackendDecorator);
});


angular.mock.e2e = {};
angular.mock.e2e.$httpBackendDecorator = ['$delegate', '$browser', createHttpBackendMock];


angular.mock.clearDataCache = function() {
  var key,
      cache = angular.element.cache;

  for(key in cache) {
    if (cache.hasOwnProperty(key)) {
      var handle = cache[key].handle;

      handle && angular.element(handle.elem).unbind();
      delete cache[key];
    }
  }
};


window.jstestdriver && (function(window) {
  
  window.dump = function() {
    var args = [];
    angular.forEach(arguments, function(arg) {
      args.push(angular.mock.dump(arg));
    });
    jstestdriver.console.log.apply(jstestdriver.console, args);
    if (window.console) {
      window.console.log.apply(window.console, args);
    }
  };
})(window);


window.jasmine && (function(window) {

  afterEach(function() {
    var spec = getCurrentSpec();
    spec.$injector = null;
    spec.$modules = null;
    angular.mock.clearDataCache();
  });

  function getCurrentSpec() {
    return jasmine.getEnv().currentSpec;
  }

  function isSpecRunning() {
    var spec = getCurrentSpec();
    return spec && spec.queue.running;
  }

  window.module = angular.mock.module = function() {
    var moduleFns = Array.prototype.slice.call(arguments, 0);
    return isSpecRunning() ? workFn() : workFn;
    function workFn() {
      var spec = getCurrentSpec();
      if (spec.$injector) {
        throw Error('Injector already created, can not register a module!');
      } else {
        var modules = spec.$modules || (spec.$modules = []);
        angular.forEach(moduleFns, function(module) {
          modules.push(module);
        });
      }
    }
  };

  
  window.inject = angular.mock.inject = function() {
    var blockFns = Array.prototype.slice.call(arguments, 0);
    var stack = new Error('Declaration Location').stack;
    return isSpecRunning() ? workFn() : workFn;
    function workFn() {
      var spec = getCurrentSpec();
      var modules = spec.$modules || [];
      modules.unshift('ngMock');
      modules.unshift('ng');
      var injector = spec.$injector;
      if (!injector) {
        injector = spec.$injector = angular.injector(modules);
      }
      for(var i = 0, ii = blockFns.length; i < ii; i++) {
        try {
          injector.invoke(blockFns[i] || angular.noop, this);
        } catch (e) {
          if(e.stack) e.stack +=  '\n' + stack;
          throw e;
        }
      }
    }
  }
})(window);
