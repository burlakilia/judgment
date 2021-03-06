/**
 *  Spider, parse site: ras.aribitr.ru 
 *          selects all court decisions and saves them to the database in a normalized form
 * 
 *  Run as serveice, in crontab
 */
var http = require('http'),
    async = require('async'),
    dm = require('domain').create(),
    stringjs = require('string'), host;

function fiddler(opts) {
    var options = {};

    options.path = 'http://' + opts.host + ':' + 80 + opts.path;
    options.headers = {
        Host: opts.host,
        'Content-Type': 'application/json',
        'Content-Length':  opts.headers['Content-Length'],
        'X-Requested-With': 'XMLHttpRequest'
    };

    options.host = '127.0.0.1';
    options.port = 8888;
    options.method = 'POST';

    return options;
}


function send(opts, data, next) {
    var page = '';

    var req = http.request(opts, function(res) {
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            page += chunk;
        });
        
        res.on('end', function() {
            next(null, page);
        });

        res.on('error', function(err) {
            next(err, null);
        });
        
    });
    
    data && req.write(data);
    req.end(); 
}

function search(data, finish) { 
    var opts = {
        host: host,
        path: '/Ras/Search',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'X-Requested-With': 'XMLHttpRequest'
        }
    };


    send(opts, data, function(err, res) {
        finish(err, JSON.parse(res.toString()));
    });
         
}

function process(item) {
    var opts = {
        host: host,
        path: '/Ras/HtmlDocument/' + item.Id,
        method: 'GET'
    }; 
    
    return function(next) {


        send(opts, null, function(err, res) {
            next(null, {
                id: item.Id,
                text: stringjs(res.replace('&nbsp', ' ')).stripTags().s
            });
        });
        
    };
    
}

function prepare(data) {
    return JSON.stringify(data);
}


exports.run = function(data, next) {
    host = data.url;
    
    dm.run(function() {

        search(prepare(data.search), function(err, res) {
            
            if (err) {
                console.log('Search error:', err);
                return;
            }

            if (res.Result === null) {
                next(null, []);
                console.log(res);
                return;
            }

            async.parallel(res.Result.Items.map(process), next);
        });
        
    }); 
    
          
    dm.on('error', function(err) {
        next(err, null);
        console.error('domain services/spider: ', err);  
    });
    
};
