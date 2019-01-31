// <!--
// +-------------------------------------------------+
// © 2002-2004 PMB Services / www.sigb.net pmb@sigb.net et contributeurs (voir www.sigb.net)
// +-------------------------------------------------+
// $Id: index.js,v 1.0 2017-08-24 09:00:00 jpermanne Exp $
// -->

var express = require('express');
var myParser = require('body-parser');
var fs = require('fs');
var os = require('os');
var dns = require('dns');
var path = require('path');
var exec = require('child_process').exec;
var tmp = require('tmp');
var Iconv = require('iconv').Iconv;
var atob = require('atob');
var app = express();
const opts = { key: fs.readFileSync('./server_key.pem')
             , cert: fs.readFileSync('./server_cert.pem')};
var http = require('https').Server(opts, app);
var io = require('socket.io')(http);


/**
 * Cette fonction va retourner les imprimantes recensées dans le fichier 'printers.json' situé dans le même dossier.
 * @returns {array} Imprimantes.
 */
function filePrinters() {
	if (fs.existsSync(__dirname + '/printers.json')) {
		return fs.readFileSync(__dirname + '/printers.json', charset, function (error, content) {
			if (content == '') {
				content = "[]";
			}
			return content;
		})
	} else {
		fs.writeFileSync(__dirname + '/printers.json', JSON.stringify([]), charset)
	}
}

/**
 * Cette fonction retourne les imprimantes enregistrées dans CUPS.
 * @returns {array} Imprimantes.
 */
function getCupsPrinters() {
	this.execCommand = function (cmd) {
		return new Promise((resolve, reject) => {
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(stdout)
			});
		})
	}
}
var cups = new getCupsPrinters();

app.use(myParser.text({
	type: "text/plain"
}));
app.use(express.static(__dirname + '/css'));
app.use(express.static(__dirname + '/js'));

var charset = 'utf-8';

app.get('/', function (request, response) {
	fs.readFile(__dirname + '/index.html', charset, function (error, content) {
		response.writeHead(200, {
			'Content-Type': 'text/html'
		});
		response.end(content, charset);
	});
});

app.get('/printers', function (request, response) {
	fs.readFile(__dirname + '/printers.html', charset, function (error, content) {
		response.writeHead(200, {
			'Content-Type': 'text/html'
		})
		response.end(content, charset)
	})
})

app.get('/getConnectedPrinters', function (request, response) {
	getConnectedPrinters(response)
})

/**
 * Cette fonction va retourner le premier id d'imprimante disponible dans le fichier 'printers.json'.
 * @param {array} idTable Tableau d'ids d'imprimantes
 * @returns {number} id disponible pour la création d'une nouvelle imprimante dans 'printers.json'.
 */
function setNewId(idTable) {
	var counter = 1;
	if (idTable.length === 0) {
		return counter
	}
	for (var i = 0; i < idTable.length; i++) {
		if (idTable[i] === counter) {
			counter++
		} else {
			continue
		}
	}
	return counter
}

/**
 * Cette fonction détermine si les imprimantes du fichier 'printers.json' sont actives ou non en fonction de celles trouvées dans CUPS.
 * 
 * Si des imprimantes trouvées via CUPS ne sont pas listées dans le fichier, elles sont alors rajoutées.
 * 
 * La valeur de la propriété active de l'imprimante est à true si elle est trouvée dans CUPS, sinon elle vaut false.
 * 
 * @param {object} response Réponse à la requête HTTP sur '/getConnectedPrinters'
 * @returns {undefined}
 */
function getConnectedPrinters(response) {

	var printerIds = [];
	var printersFromFile = [];
	var toWrite = []

	// os.EOL si jamais, pour séparer les lignes (si toutes se terminent par un \n)
	filePrinters() === '' ? printersFromFile = [] : printersFromFile = JSON.parse(filePrinters())

	// Vérification de correspondance entre le json et le retour de "lpstat -a" à faire ici
	cups.execCommand('lpstat -a').then(res => {
		res = res.split(os.EOL)
		for (var i = 0; i < res.length; i++) {
			printerIds.push(res[i].split(' ')[0]) // On récupère le 1er mot (le nom cups de l'imprimante)
		}
		printerIds.pop() // On retire la chaine vide occasionnée par le \n
		toWrite = printersFromFile;

		var cupsPrintersIndex = []

		// ici, on créé un tableau des indices correspondants aux identifiants retournés par 'lpstat -a'
		printerIds.forEach(id => {
			cupsPrintersIndex.push(printersFromFile.findIndex(x => x.name === id))
		})

		/**
		 * Cette fonction retourne les id des imprimantes du fichier 'printers.json'.
		 * @returns {array} ids des imprimantes trouvées dans 'printers.json'.
		 */
		function getIds() {
			var filePrintersIndex = []
			toWrite.forEach(printer => {
				filePrintersIndex.push(printer.id)
			})
			return filePrintersIndex
		}

		if (printerIds.length > 0) {
			for (var i = 0; i < cupsPrintersIndex.length; i++) {
				if (printersFromFile.findIndex(x => x.name === printerIds[i]) === -1) {
					toWrite.push({
						id: setNewId(getIds()),
						name: printerIds[i],
						active: true,
						type: 'epson'
					})
				}
			}

			// On passe les imprimantes à true si elles sont retournées par la commande 'lpstat -a'
			for (var i = 0; i < toWrite.length; i++) {
				if (printerIds.indexOf(toWrite[i].name) !== -1) toWrite[i].active = true
				else toWrite[i].active = false
			}
		}
		fs.writeFile(__dirname + '/printers.json', JSON.stringify(toWrite, null, 4))
		answer(toWrite, response)
	}).catch(err => {
		response.writeHead(501, {
			'Content-Type': 'text/html'
		})
		response.end(err, charset)
	})
}

/**
 * Cette fonction est utilisée pour répondre à une requête HTTP (quand elle s'est bien passée).
 * @param {object} content Contenu qui sera envoyé dans la réponse à la requête
 * @param {object} res Réponse à la requête
 * @returns {undefined}
 */
function answer(content, res) {
	res.writeHead(200, {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'text/html'
	})
	res.end(JSON.stringify(content), charset)
}

app.post('/savePrinters', function (request, response) {
	var printers;
	for (var p in request.body) {
		printers = JSON.parse(p)
	}
	fs.writeFile(__dirname + '/printers.json', JSON.stringify(printers, null, 4))
	response.writeHead(200, {
		'Content-Type': 'text/html'
	})
	response.end('Successfully saved')
})

app.get('/getPrinter', function (request, response) {
	var printer = 'unknown';
	var inFile = filePrinters();

	if (inFile !== '') {
		var printers = JSON.parse(filePrinters())
		var printerIndex = printers.findIndex(x => x.id == request.query.idPrinter)
		response.writeHead(200, {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': 'text/html'
		});
		if (printerIndex != -1) {
			printer = printers[printerIndex].type
		}
		response.end(printer, charset);
	} else {
		response.writeHead(404, {
			'Content-Type': 'text/html'
		})
		response.end('Aucune imprimante, veuillez ajouter des imprimantes via <a href="//192.168.0.82:631/admin" target="_blank">Cups</a>', charset);
	}
})

app.post('/print', function (request, response) {
	var printInfos = JSON.parse(request.body)
	var printers = JSON.parse(filePrinters());

	var printerIndex = printers.findIndex(x => x.id == printInfos.idPrinter);
	var tmpobj = tmp.fileSync();
	// tpmobj.name est égal à l'url du fichier temporaire
	var iconv = new Iconv('UTF-8', 'CP437');

	// On ajoute plein de fois le caractère d'initialisation pour éviter que l'entête ne soit coupée
	var toPrint = iconv.convert('\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@' + printInfos.xml);
	fs.writeFileSync(tmpobj.name, toPrint);

	exec('cat ' + tmpobj.name + ' | lp -d ' + printers[printerIndex].name + ' -', (err, stdout, stderr) => {
		if (stdout) {
			response.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'text/html'
			});
			response.end('Print done.', charset);
			tmpobj.removeCallback(); // Suppression du fichier temporaire			
		}
		if (err) {
			response.writeHead(200, {
                                'Access-Control-Allow-Origin': '*',
                                'Content-Type': 'text/html'
                        });
                        response.end(err, charset);
		}
	});
});

app.get('/deletePrinter', function (request, response) {
	var currentPrinters = JSON.parse(filePrinters());
	var index = currentPrinters.findIndex(x => x.id == request.query.idPrinter);
	response.writeHead(200, {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'text/html'
	});
	if (index !== -1) {
		currentPrinters.splice(index, 1);
		fs.writeFile(__dirname + '/printers.json', JSON.stringify(currentPrinters, null, 4));

		response.end(JSON.stringify({
			result: true,
			printer: request.query.idPrinter
		}), charset);
	} else {
		response.end('Cette imprimante n\'existe pas', charset);
	}
	io.emit('update', 'delete', request.query.idPrinter);
})

app.get('/config', function (request, response) {
	var ip_address = '';
	var netmask = '';
	var gateway = '';
	var dns = '';
	var array = fs.readFileSync('/etc/dhcpcd.conf').toString().split("\n");

	for (i in array) {
		var matches = array[i].match(/^static ip_address=(.+)$/);
		if (matches != null) {
			ip_address = matches[1];
		}
		matches = array[i].match(/^static netmask=(.+)$/);
		if (matches != null) {
			netmask = matches[1];
		}
		matches = array[i].match(/^static routers=(.+)$/);
		if (matches != null) {
			gateway = matches[1];
		}
		matches = array[i].match(/^static domain_name_servers=(.+)$/);
		if (matches != null) {
			dns = matches[1];
		}
	}

	fs.readFile(__dirname + '/config.html', charset, function (error, content) {
		content = content.replace('!!ip_address!!', ip_address);
		content = content.replace('!!netmask!!', netmask);
		content = content.replace('!!gateway!!', gateway);
		content = content.replace('!!dns!!', dns);
		response.writeHead(200, {
			'Content-Type': 'text/html'
		});
		response.end(content, charset);
	});
});

/**
 * Attention : Cette fonction nécessitera de relancer la commande 'node index' en ligne de commande depuis le Raspberry Pi.
 * 
 * Cette fonction permet de redémarrer le Raspberry Pi.
 * @param {function} callback
 * @returns {undefined}
 */
function reboot(callback) {
	exec('sudo reboot', function (error, stdout, stderr) {
		callback(stdout);
	});
}

app.post("/config", function (request, response) {
	var ip_address = request.body.ip_address;
	var netmask = request.body.netmask;
	var gateway = request.body.gateway;
	var dns = request.body.dns;
	var array = fs.readFileSync('/etc/dhcpcd.conf').toString().split("\n");

	for (i in array) {
		var matches = array[i].match(/^static ip_address=.+$/);
		if (matches != null) {
			array[i] = 'static ip_address=' + ip_address;
		}
		matches = array[i].match(/^static netmask=.+$/);
		if (matches != null) {
			array[i] = 'static netmask=' + netmask;
		}
		matches = array[i].match(/^static routers=.+$/);
		if (matches != null) {
			array[i] = 'static routers=' + gateway;
		}
		matches = array[i].match(/^static domain_name_servers=.+$/);
		if (matches != null) {
			array[i] = 'static domain_name_servers=' + dns;
		}
	}

	fs.writeFile('/etc/dhcpcd.conf', array.join('\n'), charset);

	fs.readFile(__dirname + '/config_post.html', charset, function (error, content) {
		content = content.replace('!!message!!', 'Configuration enregistrée, le raspberry va démarrer.');
		response.writeHead(200, {
			'Content-Type': 'text/html'
		});
		response.end(content, charset);
	});

	reboot(function (output) {
		console.log(output);
	});
});

http.listen(3000);

/*
 * Cette fonction retourne l'adresse IP du Raspberry Pi sur lequel elle est exécutée
 * @returns {string} ip
 */

(function startingLog(callback) {
	exec('hostname -I', (err, stdout, stderr) => {
		if (err) console.log(err)
		if (stdout) {
			let ip = JSON.stringify(stdout)
			ip = ip.substr(1, ip.length - 5)
			console.log('L\'interface de configuration des imprimantes est accessible à l\'adresse suivante ---> http://' + ip + ':3000/printers <---')
			console.log('Pour changer la configuration du raspberry pi, rendez-vous sur ---> http://' + ip + ':3000/config <---')
		}
	})
})()
