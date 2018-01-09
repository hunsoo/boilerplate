const express = require('express');
const app = express();
const User = require('./db/User')

// logging
const morgan = require('morgan');
app.use(morgan('dev'));

// static resources
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// use sessions
// we will need our sequelize instance from somewhere
const db = require('./db');
// we should do this in the same place we've set up express-session
const session = require('express-session');

// configure and create our database store
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const dbStore = new SequelizeStore({ db: db });

// sync so that our session table gets created
dbStore.sync();

// plug the store into our session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'a wildly insecure secret',
  store: dbStore,
  resave: false,
  saveUninitialized: false
}));

// Passport Implementation
const passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => {
  try {
    done(null, user.id);
  } catch (err) {
    done(err);
  }
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => done(null, user))
    .catch(done);
});
// server.js
app.use('/api', require('./api')); // matches all requests to /api

app.post('/login', (req, res, next) => {
  User.findOne({
    where: {
      email: req.body.email
    }
  })
    .then(user => {
      if (!user) res.status(401).send('User not found');
      else if (!user.hasMatchingPassword(req.body.password)) res.status(401).send('Incorrect password');
      else {
        req.login(user, err => {
          if (err) next(err);
          else res.json(user);
        });
      }
    })
    .catch(next);
});

app.post('/signup', (req, res, next) => {
  User.create(req.body)
    .then(user => {
      req.login(user, err => {
        if (err) next(err);
        else res.json(user);
      });
    })
    .catch(next);
});

app.post('/logout', (req, res, next) => {
  req.logout();
  res.sendStatus(200);
});

app.get('/me', (req, res, next) => {
  res.json(req.user);
});

app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(function (err, req, res, next) {
  console.error(err);
  console.error(err.stack);
  res.status(err.status || 500).send(err.message || 'Internal server error.');
});

// say our sequelize instance is create in 'db.js'
// and our server that we already created and used as the previous entry point is 'server.js'
const port = process.env.PORT || 3000;

db.sync()  // sync our database
  .then(function () {
    app.listen(port) // then start listening with our express server once we have synced
    console.log('Listening on Port', port);
  });
