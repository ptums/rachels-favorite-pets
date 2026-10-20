var express = require('express');
var passport = require('passport');
var settings = require('./settings');
// settings.credentials().db_name
var mysql = require("mysql");
var fs = require('fs');
var _ = require('underscore');
var multer  = require('multer');
var bodyParser = require("body-parser");
var upload = multer({
  dest: 'public/images',
  rename: function(fieldname, filename) {
        return filename;
    },
});
var LocalStrategy = require('passport-local').Strategy;
var db = require('./db');
// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new LocalStrategy(
  function(username, password, cb) {
    db.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  }));

  // Configure Passport authenticated session persistence.
  //
  // In order to restore authentication state across HTTP requests, Passport needs
  // to serialize users into and deserialize users out of the session.  The
  // typical implementation of this is as simple as supplying the user ID when
  // serializing, and querying the user record by ID from the database when
  // deserializing.
  passport.serializeUser(function(user, cb) {
    cb(null, user.id);
  });

  passport.deserializeUser(function(id, cb) {
    db.users.findById(id, function (err, user) {
      if (err) { return cb(err); }
      cb(null, user);
    });
  });
  // Create a new Express application.
  var app = express();

  // Configure view engine to render EJS templates.
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');

  // Use application-level middleware for common functionality, including
  // logging, parsing, and session handling.
  app.use(require('morgan')('combined'));
  app.use(require('cookie-parser')());
  app.use(require('body-parser').urlencoded({ extended: true }));
  app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

  // Initialize Passport and restore authentication state, if any, from the
  // session.
  app.use(passport.initialize());
  app.use(passport.session());


app.use(bodyParser.json());
app.use(express.static('public'));

/**
 * Homepage
 */
app.get('/',
  function(req, res) {
    res.render('index', { user: req.user });
  });

/**
 * User login page
 */
app.get('/login',
  function(req, res){
    if (!req.user) {
      res.render('login');
    }
    else {
      res.redirect('upload');
    }
  });

/**
 * Handle submission of the user login form
 */
app.post('/login',
  passport.authenticate('local', {
   successRedirect: 'upload',
   failureRedirect: 'logout'
  }));

/**
 * Allow the user to logout
 */
app.get('/logout',
  function(req, res){
    req.logout();
     res.render('index');
  });

/**
 * Generate the image upload page
 */
app.get('/upload',
  function(req, res){
    res.render('upload');
  });

/**
 * Handle submission of the file upload form
 */
app.post('/file-upload',
  upload.single('image'), function (req, res, next) {
    if (req.user) {
  
      //Get the database username and password
      var connection = mysql.createConnection(settings.credentials());

      //Open a connection to the database
      connection.connect();

      //Write to the database
      connection.query('INSERT INTO images SET ?', {path: req.file.originalname}, function(err, result) {
        if (err) {
          throw err;
        }
        else {
          //Rename files after they are uploaded
          fs.rename(req.file.path, 'public/images/' + req.file.originalname);

          //Return to the upload form for more uploading
          res.redirect('upload');
        }
      });

      //Close the database connection
      connection.end()
      
    }
    else {
      res.send('no');
    }

  });

/**
 * List all the photos currently in the system
 */
app.get('/api/pets',
  function(req, res){

    //Get the database username and password
    var connection = mysql.createConnection(settings.credentials());

    //Open a connection to the database
    connection.connect();

    //Write to the database
    connection.query('SELECT path FROM images', function(err, result){
      _.each(result, function(item, index, list){
        result[index] = item.path;
      });
      res.send(result);
    });

    //todo, cache this

  });

/**
 * Allow deletion of a photo
 */
app.post('/delete', function (req, res){
  if (req.user) {
    fs.unlink('public/images/' + req.body.image);

    //Delete from the database
    //@todo make this work
    // var connection = mysql.createConnection(settings.credentials());
    // connection.connect();
    // connection.query('DELETE FROM images WHERE path="' + req.body.image + '"')

    res.send('yes');
  }
  else {
    //todo, does this work?
    res.send('no');
  }
});

app.listen(3000);
console.log("its alive!!!!!");
