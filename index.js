var assert_required   = require('./lib/assert_required');
var base64_url_decode = require('./lib/base64_url_decode');
var qs                = require('qs');
var reqwest           = require('reqwest');

var use_jsonp         = require('./lib/use_jsonp');
var LoginError        = require('./lib/LoginError');

function Auth0 (options) {
  if (!(this instanceof Auth0)) {
    return new Auth0(options);
  }

  assert_required(options, 'clientID');
  assert_required(options, 'callbackURL');
  assert_required(options, 'domain');

  this._clientID = options.clientID;
  this._callbackURL = options.callbackURL;
  this._domain = options.domain;

  if (options.success && window.location.hash.match(/access_token/)) {
    var parsed_qs = qs.parse(window.location.hash);
    var id_token = parsed_qs.id_token;
    var encoded = id_token.split('.')[1];
    var prof = JSON.parse(base64_url_decode(encoded));
    options.success(prof, id_token, parsed_qs.access_token, parsed_qs.state);
  }
  this._failure = options.failure;
}

Auth0.prototype._redirect = function (url) {
  global.window.location = url;
};

Auth0.prototype._renderAndSubmitWSFedForm = function (formHtml) {
  var div = document.createElement('div');
  div.innerHTML = formHtml;
  var form = document.body.appendChild(div).children[0];
  form.submit();
};

Auth0.prototype.signup = function (options, callback) {
  var self = this;
  
  var query = {
    response_type: 'token',
    client_id:     this._clientID,
    connection:    options.connection,
    redirect_uri:  this._callbackURL,
    scope:         'openid profile'
  };

  if (options.state) {
    query.state = options.state;
  }

  query.email = options.username || options.email;
  query.password = options.password;
  
  query.tenant = this._domain.split('.')[0];

  // if (use_jsonp()) {
  //   return reqwest({
  //     url:     'https://' + this._domain + '/dbconnections/login',
  //     type:    'jsonp',
  //     data:    query,
  //     jsonpCallback: 'cbx',
  //     success: function (resp) {
  //       if('error' in resp) {
  //         return self._failure(resp);
  //       }
  //       self._renderAndSubmitWSFedForm(resp.form);
  //     }
  //   });
  // }

  reqwest({
    url:     'https://' + this._domain + '/dbconnections/signup',
    method:  'post',
    type:    'html',
    data:    query,
    success: function (resp) {
      if ('auto_login' in options && !options.auto_login) {
        if (callback) callback(null, resp.responseText);
        return;
      }
      self.login(options, callback);
    }
  }).fail(function (err) {
    var error = new LoginError(err.status, err.responseText);
    if (callback)      return callback(error);
    if (self._failure) return self._failure(error); 
  });
};

Auth0.prototype.login = function (options, callback) {
  var self = this;
  
  var query = {
    response_type: 'token',
    client_id:     this._clientID,
    connection:    options.connection,
    redirect_uri:  this._callbackURL,
    scope:         'openid profile'
  };

  if (options.state) {
    query.state = options.state;
  }

  if ('username' in options && 'password' in options) {
    query.username = options.username || options.email;
    query.password = options.password;
    
    query.tenant = this._domain.split('.')[0];

    if (use_jsonp()) {
      return reqwest({
        url:     'https://' + this._domain + '/dbconnections/login',
        type:    'jsonp',
        data:    query,
        jsonpCallback: 'cbx',
        success: function (resp) {
          if('error' in resp) {
            return self._failure(resp);
          }
          self._renderAndSubmitWSFedForm(resp.form);
        }
      });
    }

    reqwest({
      url:     'https://' + this._domain + '/dbconnections/login',
      method:  'post',
      type:    'html',
      data:    query,
      success: function (resp) {
        self._renderAndSubmitWSFedForm(resp);
      }
    }).fail(function (err) {
      var error = new LoginError(err.status, err.responseText);
      if (callback)      return callback(error);
      if (self._failure) return self._failure(error); 
    });

  } else {
    this._redirect('https://' + this._domain + '/authorize?' + qs.stringify(query));
  }
};

if (global.window) {
  global.window.Auth0 = Auth0;
}
module.exports = Auth0;