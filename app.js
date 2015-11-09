"use strict";

var debug = false, interval = 300;

var mysql = require('mysql');
var conn = mysql.createConnection({
	host: process.env.VCAP_MYSQL_HOST || 'localhost',
	port: parseInt(process.env.VCAP_MYSQL_PORT) || 3306,
	database: process.env.VCAP_MYSQL_PORT || 'monitoring',
	user: process.env.VCAP_MYSQL_USER || 'monitoring',
	password: process.env.VCAP_MYSQL_PASSWORD || 'monitoring'
});

conn.connect(function(err) {
	function getApps(callback) {
		conn.query('select name, url, active from monitoring_app order by name', callback);
	}
	function addApp(name, url, callback) {
		conn.query('insert into monitoring_app(name, url) values (?)', { name: name, url: url }, callback);
	}
	function removeApp(name, callback) {
		conn.query('delete from monitoring_app where name = \'' + name + '\'', callback);
	}
	function updateApp(name, data, callback) {
		data = data || {};
		conn.query('update monitoring_app set ? where name = \'' + name + '\'', data, callback);
	}
	function saveData(name, data, callback) {
		conn.query('insert into monitoring_data(name, data) values (?)', { name: name, data: JSON.stringify(data) }, callback);
	}

	if (err) {
		console.error('MySQL error: ' + err.stack);
		return;
	} else
		console.log('Connected to MySQL');

	var simplicite = require('simplicite');
	var apps;
	getApps(function (err, rs) {

		function monitorApp(name, callback) {
			var session = apps[name].session;
			if (session) {
				console.log('Request to ' + name);
				session.getHealth().then(function(health) {
					try {
						var n = health._scope._name;
						delete health._scope; // Remove scope reference from response
						health.name = n; // Add name for health view
						apps[n].status = 200;
						apps[n].health = health;
						// TODO: save health data
						console.log('Response from ' + n + ' = ' + health.platform.status);
						if (callback) callback.call(this, name);
					} catch(e) {
						console.error(e);
					}
				}, function(err) {
					try {
						var n = err._scope._name;
						delete err._scope; // Remove scope reference from response
						apps[n].status = err.status || 404;
						delete apps[n].health;
						console.error('Error on ' + n + ' = ' + err.message);
					} catch(e) {
						console.error(e);
					}
				});
			}
		}

		function monitorApps() {
			for (var name in apps) monitorApp(name);
			setTimeout(monitorApps, interval * 1000);
		}
		
		apps = {};
		if (!err) {
			for (var k = 0; k < rs.length; k++) {
				var r = rs[k];
				apps[r.name] = r;
				apps[r.name].status = 0;
				if (r.active === '1') {
					apps[r.name].session = simplicite.session({ url: r.url, debug: debug });
					apps[r.name].session._name = r.name; // ZZZ Name stored at session level to retreive it then() functions
				}
			}
			monitorApps();
			
			var express = require('express');
			var server = express();
			server.use(express.static(__dirname + '/public'));
			server.set('view engine', 'jade');
			server.set('views', __dirname + '/views');

			server.get('/', function(req, res) {
				function render(n) {
					console.log(n);
					var h = apps[n].health;
					if (h)
						res.render('health', h);
					else
						res.render('error', { error: 'No data for name = ' + n });
				}

				res.header('Cache-Control', 'private, no-cache, no-store, no-transform, must-revalidate');
				res.header('Expires', '-1');
				res.header('Pragma', 'no-cache');
				console.log('Home page requested');
				var name = req.query ? req.query.name : null;
				if (name) {
					console.log('Health page requested for name = ' + name);
					var force = req.query ? req.query.force : null;
					if (force)
						monitorApp(name, render);
					else
						render(name);
				} else
					res.render('index', { size: rs.length, rows: apps });
			});

			var args = process.argv.slice(2);
			var host = process.env.VCAP_APP_HOST || args[0] || 'localhost';
			var port = process.env.VCAP_APP_PORT || args[1] || 3000;

			server.listen(port, parseInt(host));

			console.log('Server listening on ' + host + ':' + port);
		} else
			console.error(err);
	});
});
