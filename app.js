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
	if (err) {
		console.error('MySQL error: ' + err.stack);
		return;
	} else
		console.log('Connected to MySQL');

	function getApps(callback) {
		conn.query('select name, url from monitoring_app where active = \'1\'', callback);
	}
	function addApp(app, callback) {
		// TODO
	}
	function removeApp(app, callback) {
		// TODO
	}
	function updateApp(app, callback) {
		// TODO
	}

	var simplicite = require('simplicite');
	var apps = {};
	getApps(function (err, rs) {
		if (!err) {
			for (var k = 0; k < rs.length; k++) {
				var r = rs[k];
				apps[r.name] = r;
				apps[r.name].session = simplicite.session({ url: r.url, debug: debug });
				apps[r.name].session._name = r.name; // ZZZ Name stored at session level to retreive it then() functions
			}

			function monitorApps() {
				for (var name in apps) {
					console.log('Background monitoring for ' + name);
					apps[name].session.getHealth().then(function(health) {
						try {
							var n = health._scope._name;
							delete health._scope;
							apps[n].status = 200;
							apps[n].health = health;
							// TODO: save health data
							console.log(n + ' = ' + JSON.stringify(health));
						} catch(e) {
							console.error(e);
						}
					}, function(err) {
						try {
							var n = err._scope._name;
							delete err._scope;
							console.log(err);
							apps[n].status = err.status || 404;
							delete apps[n].health;
							console.error(n + ' = ' + JSON.stringify(err));
						} catch(e) {
							console.error(e);
						}
					});
				}
				setTimeout(monitorApps, interval * 1000);
			}
			monitorApps();
			
			var express = require('express');
			var server = express();
			server.use(express.static(__dirname + '/public'));
			server.set('view engine', 'jade');
			server.set('views', __dirname + '/views');

			server.get('/', function(req, res) {
				res.header('Cache-Control', 'private, no-cache, no-store, no-transform, must-revalidate');
				res.header('Expires', '-1');
				res.header('Pragma', 'no-cache');
				console.log('Home page requested');
				res.render('index', { size: rs.length, rows: apps });
			});

			server.get('/health', function(req, res) {
				res.header('Cache-Control', 'private, no-cache, no-store, no-transform, must-revalidate');
				res.header('Expires', '-1');
				res.header('Pragma', 'no-cache');
				var name = req.query ? req.query.name : null;
				if (name) {
					console.log('Health page requested for name = ' + name);
					var h = apps[name].health;
					if (h)
						res.render('health', h);
					else
						res.render('error', { error: 'No data' });
				} else
					res.render('error', { error: 'Missing name' });
			});

			var host = process.env.VCAP_APP_HOST || 'localhost';
			var port = process.env.VCAP_APP_PORT || 3000;

			server.listen(port, host);

			console.log('Server listening on ' + host + ':' + port);
		} else
			console.error(err);
	});
});
