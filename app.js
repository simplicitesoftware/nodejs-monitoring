var express = require('express');
var app = express();
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);

var params = {
	scheme: process.env.SIMPLICITE_SCHEME || 'http',
	host: process.env.SIMPLICITE_HOST || 'demo.apps.simplicite.io',
	port: process.env.SIMPLICITE_PORT || 80,
	root: process.env.SIMPLICITE_ROOT || '',
	user: process.env.SIMPLICITE_USER || 'admin',
	password: process.env.SIMPLICITE_PASSWORD || 'admin',
	debug: true
};
var simplicite = require('simplicite').session(params);

var prd = simplicite.getBusinessObject('DemoProduct');

app.get('/', function(req, res) {
	console.log('Home page requested');
	simplicite.getHealth().then(function(health) {
		res.render('index', health);
	});
});

console.log('Server listening on ' + host + ':' + port);
app.listen(port, host);
