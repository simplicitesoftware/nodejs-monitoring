"use strict";

var debug = false, interval = 300;

var mysql = require('mysql');
var mysqlConfig = {
	host: process.env.VCAP_MYSQL_HOST || '127.0.0.1',
	port: parseInt(process.env.VCAP_MYSQL_PORT) || 3306,
	database: process.env.VCAP_MYSQL_PORT || 'monitoring',
	user: process.env.VCAP_MYSQL_USER || 'monitoring',
	password: process.env.VCAP_MYSQL_PASSWORD || 'monitoring'
};
function getConnection(callback) {
	var conn = mysql.createConnection(mysqlConfig);
	conn.connect(function(err) {
		if (!err)
			callback.call(this, conn);
		else
			console.error('MySQL error: ' + err.stack);
	});
}

var nbapps, apps;

function monitorApp(name, callback) {
	if (!apps[name].session && apps[name].active === '1') {
		apps[name].session = simplicite.session({ url: apps[name].url, debug: debug });
		apps[name].session._name = name; // ZZZ Name stored at session level to retrieve it then() functions
	}
	if (apps[name].session) {
		console.log('Request to ' + name);
		apps[name].session.getHealth().then(function(health) {
			try {
				var n = health._scope._name;
				delete health._scope; // Remove scope reference from response

				health.name = n; // Add name for health view

				// Version 3.0 compatibility tweaks
				if (typeof health.cache.grantcache === 'string') {
					var c = health.cache.grantcache.split('/');
					health.cache.grantcache = parseInt(c[0]); 
					health.cache.grantcachemax = parseInt(c[1]); 
				}
				if (typeof health.cache.objectcache === 'string') {
					var c = health.cache.objectcache.split('/');
					health.cache.objectcache = parseInt(c[0]); 
					health.cache.objectcachemax = parseInt(c[1]); 
				}
				if (typeof health.cache.processcache === 'string') {
					var c = health.cache.processcache.split('/');
					health.cache.processcache = parseInt(c[0]); 
					health.cache.processcachemax = parseInt(c[1]); 
				}
				if (!health.application.activesessions) health.application.activesessions = 0;

				apps[n].status = 200;
				apps[n].health = health;
				console.log('Response from ' + n + ' = ' + health.platform.status);

				getConnection(function(c) {
					c.query('insert into monitoring_data set ?', {
						name: n,
						ts: health.healthcheck.date,
						activesessions: health.application.activesessions,
						totalusers: health.application.totalusers,
						enabledusers: health.application.enabledusers,
						heapfree: health.javavm.heapfree,
						heapsize: health.javavm.heapsize,
						heapmaxsize: health.javavm.heapmaxsize,
						totalfreesize: health.javavm.totalfreesize,
						grantcache: health.cache.grantcache,
						grantcachemax: health.cache.grantcachemax,
						objectcache: health.cache.objectcache,
						objectcachemax: health.cache.objectcachemax,
						processcache: health.cache.processcache,
						processcachemax: health.cache.processcachemax,
						diskfree: health.disk.diskfree,
						diskusable: health.disk.diskusable,
						disktotal: health.disk.disktotal
					}, function(err) {
						if (err) console.error('MySQL error: ' + err.stack);
						c.destroy();
						if (callback) callback.call(this, name);
					});
				});
			} catch(e) {
				console.error(e);
			}
		}, function(err) {
			try {
				var n = err._scope._name;
				delete err._scope; // Remove scope reference from response
				var s = err.status || 404;
				var alert = apps[n].status === 200 && s !== 200;
				apps[n].status = s;
				if (alert) sendAlert(n); // Send alert once when status is not 200
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

var mailfrom = process.env.VCAP_MAIL_FROM;
var mailto = process.env.VCAP_MAIL_TO;
var mailer = require('nodemailer');
var smtp = require('nodemailer-smtp-transport');
var mailhost = process.env.VCAP_MAIL_HOST || '127.0.0.1';
var mailport = parseInt(process.env.VCAP_MAIL_PORT) || 25;
var mailtransport = mailer.createTransport(new smtp({ host: mailhost, port: mailport }));
function sendAlert(name) {
	var a = apps[name];
	console.log("Send alert for " + name);
	if (mailfrom && mailto) {
		mailtransport.sendMail({
			from: mailfrom,
			to: mailto,
			subject: 'Monitoring alert on ' + name,
			html: '<html><body style="font-family: Arial;"><p>Application <b>' + name + '</b> (<a href="' + a.url + '">' + a.url + '</a>) seems down<br/>Status = <b>' + a.status + '</b></p></body></html>'
		});
	}
}

var simplicite = require('simplicite');
getConnection(function(conn) {
	conn.query('select name, url, active from monitoring_app order by name', function (err, rs) {
		apps = {};
		nbapps = 0;
		if (!err) {
			nbapps = rs.length;
			for (var k = 0; k < nbapps; k++) {
				var r = rs[k];
				apps[r.name] = r;
				apps[r.name].status = 0;
			}
			monitorApps();
			conn.destroy();

			var express = require('express');
			var server = express();
			server.use(express.static(__dirname + '/public'));
			server.set('view engine', 'jade');
			server.set('views', __dirname + '/views');
	
			var args = process.argv.slice(2);
			var serverHost = process.env.VCAP_APP_HOST || args[0] || '127.0.0.1';
			var serverPort = process.env.VCAP_APP_PORT || args[1] || 3000;
	
			var basicAuth = require('basic-auth');
			var basicAuthUser = process.env.VCAP_APP_USERNAME || args[2];
			var basicAuthPass = process.env.VCAP_APP_PASSWORD || args[3];
	
			server.get('/', function(req, res) {
				function render(n) {
					var h = apps[n].health;
					if (h)
						res.render('health', h);
					else
						res.render('error', { error: 'No data for name = ' + n });
				}
	
				res.header('Cache-Control', 'private, no-cache, no-store, no-transform, must-revalidate');
				res.header('Expires', '-1');
				res.header('Pragma', 'no-cache');
	
				var credentials = basicAuth(req);
				if (basicAuthUser && basicAuthPass && (!credentials || credentials.name != basicAuthUser || credentials.pass != basicAuthPass)) {
					res.statusCode = 401;
					res.setHeader('WWW-Authenticate', 'Basic realm="Monitoring"');
					res.render('error', { error: 'Access denied' });
				} else {
					var name = req.query ? req.query.name : null;
					if (name) {
						var action = req.query.action;
						if (action === 'start' || action === 'stop') {
							var a = action === 'start' ? '1' : '0';
							getConnection(function(c) {
								console.log('Application ' + name + ', active = ' + a);
								c.query('update monitoring_app set active = \'' + a + '\' where name = \'' + name + '\'', function(err) {
									if (!err) {
										apps[name].active = a;
										apps[name].status = 0;
										delete apps[name].health;
										delete apps[name].session;
										res.render('index', { size: nbapps, rows: apps });
									} else {
										console.error('MySQL error: ' + err.stack);
										res.render('error', { error: err.message })
									}
								});
							});
						//} else if (action === 'add') {
							//getConnection(function(c) {
								//c.query('insert into monitoring_app(name, url) values (?)', { name: name, url: url }, function(err) {...});
							//});
						//} else if (action === 'remove') {
							//getConnection(function(c) {
								//c.query('delete from monitoring_app where name = \'' + name + '\'', function(err) {...});
							//});
						} else { // action === 'health'
							var force = req.query ? req.query.force : null;
							if (force)
								monitorApp(name, render);
							else
								render(name);
						}
					} else
						res.render('index', { size: nbapps, rows: apps });
				}
			});

			server.listen(serverPort, serverHost);
			console.log('Server listening on ' + serverHost + ':' + serverPort);
		} else {
			console.error('MySQL error: ' + err.stack);
			res.render('error', { error: err.message })
		}
	});
});