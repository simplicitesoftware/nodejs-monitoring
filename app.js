var mysql = require('mysql');
var conn = mysql.createConnection({
	host: process.env.VCAP_MYSQL_HOST || 'localhost',
	port: process.env.VCAP_MYSQL_PORT || 3306,
	database: process.env.VCAP_MYSQL_PORT || 'test',
	user: process.env.VCAP_MYSQL_USER || 'root',
	password: process.env.VCAP_MYSQL_PASSWORD || ''
});

conn.connect(function(err) {
	if (err) {
		console.error('MySQL error: ' + err.stack);
		return;
	} else
		console.log('Connected to MySQL');

	var simplicite = require('simplicite').session({
		scheme: process.env.VCAP_SIMPLICITE_SCHEME || 'http',
		host: process.env.VCAP_SIMPLICITE_HOST || 'demo.apps.simplicite.io',
		port: process.env.VCAP_SIMPLICITE_PORT || 80,
		root: process.env.VCAP_SIMPLICITE_ROOT || '',
		user: process.env.VCAP_SIMPLICITE_USER || 'admin',
		password: process.env.VCAP_SIMPLICITE_PASSWORD || 'admin',
		debug: true
	});

	var express = require('express');
	var app = express();
	app.use(express.static(__dirname + '/public'));
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');

	app.get('/', function(req, res) {
		console.log('Home page requested');
		simplicite.getHealth().then(function(health) {
			res.render('index', health);
		});
	});

	var host = process.env.VCAP_APP_HOST || 'localhost';
	var port = process.env.VCAP_APP_PORT || 3000;

	app.listen(port, host);

	console.log('Server listening on ' + host + ':' + port);
});
