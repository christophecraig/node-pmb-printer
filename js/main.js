'use strict';

var foundPrinters = [];
var xhr = new XMLHttpRequest();
xhr.open('GET', '/getConnectedPrinters', true);
xhr.send();
xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
        display(JSON.parse(xhr.response));
    }
}

function display(printers) {
    foundPrinters = printers;
    var parent = document.getElementById('printers');
    // TODO : Ci-dessous on vire tout le html de div#printers, voir pour une solution plus performante que de tout supprimer puis réécrire. Vue.JS ?
    parent.innerHTML = '';

    for (var i = 0; i < printers.length; i++) {
        var el = document.createElement('div');
        el.setAttribute('id', 'printer' + printers[i].id);
        parent.appendChild(el);

        var printer = document.getElementById('printer' + printers[i].id);
        printer.classList.add('printer');

        el = document.createElement('h2');
        el.appendChild(document.createTextNode(printers[i].name));
        printer.appendChild(el);

        el = document.createElement('label');
        el.classList.add('type-toggle');
        el.setAttribute('for', printers[i].id);
        el.setAttribute('id', 'label' + printers[i].id);
        printer.appendChild(el);

        el = document.createElement('span')
        el.appendChild(document.createTextNode('Id : ' + printers[i].id))
        printer.appendChild(el)

        el = document.createElement('span')
        el.classList.add('status')
        el.appendChild(document.createTextNode(printers[i].active ? 'active' : 'inactive'))
        printer.appendChild(el)

        el = document.createElement('span');
        el.appendChild(document.createTextNode('Star'));

        var label = document.getElementById('label' + printers[i].id);
        label.appendChild(el);

        el = document.createElement('input');
        el.setAttribute('type', 'checkbox');
        el.setAttribute('id', printers[i].id);
        el.setAttribute('onchange', 'updateOnServer(this.id)');

        if (printers[i].type !== 'epson' && printers[i].type !== 'star') {
            printer.appendChild(el);
            printer.appendChild(document.createTextNode('Unknown type of printer, please choose Epson or Star'));
        } else {
            if (printers[i].type === 'epson') {
                el.setAttribute('checked', 'true');
            }
            printer.insertBefore(el, label);
        }

        if (printers[i].active === false) {
            printer.classList.add('disabled');
        }

        el = document.createElement('span');
        el.appendChild(document.createTextNode('Epson'));
        label.appendChild(el);
        
        el = document.createElement('button');
        el.appendChild(document.createTextNode('Supprimer'));
        el.classList.add('btn');
        el.setAttribute('onclick', 'deletePrinter(this.parentNode.id)');
        printer.appendChild(el);

    }
    var el = document.createElement('a');
    el.setAttribute('target', '_blank')
    el.setAttribute('href', '//' + window.location.hostname + ':631/admin');
    el.appendChild(document.createTextNode('Pour ajouter une imprimante, veuillez passer par l\'interface d\'administration de CUPS'));
    parent.appendChild(el);
}

function deletePrinter(id) {
    if (confirm('Êtes-vous sur de vouloir supprimer cette imprimante ?')) {
        var xhrDel = new XMLHttpRequest();
        xhrDel.open('GET', '/deletePrinter?idPrinter=' + id.charAt(id.length - 1)); // id est de la forme 'printer' + id (printer1, printer2), on veut donc simplement récupérer le dernier caractère
        xhrDel.send();
    }
}

function updateLocally(id) {
    var indexToChange = foundPrinters.findIndex(x => x.id == id);
    if (foundPrinters[indexToChange].type == 'epson') {
        foundPrinters[indexToChange].type = 'star';
    } else {
        foundPrinters[indexToChange].type = 'epson';
    }
    return JSON.stringify(foundPrinters);
}

function updateOnServer(id) {
    var printers = updateLocally(id);
    var xhrSave = new XMLHttpRequest();
    xhrSave.open('POST', '/savePrinters', true);
    xhrSave.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhrSave.send(printers);
    xhrSave.onreadystatechange = function () {
        if (xhrSave.readyState == 4) {
            display(JSON.parse(printers));
        }
    }
}

function test(id) {
    var xhrPrint = new XMLHttpRequest();
    xhrPrint.open('POST', '/print', true)
    //xhrPrint.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=iso-8859-15');
    xhrPrint.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    //xhrPrint.send(id, 'excellent é É à â ê')
    xhrPrint.send(JSON.stringify({idPrinter:id,xml:"\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b@\u001b\u0074\u0010\u001d!\u0001Centre de documentation des autruches\u001d!\u0000\nAdresse 1\nChâteau du Loir\n02 43 440 660\njpermanne@sigb.net\n\nEdité le : 30/11/2017\n\nEmprunteur:\n 3A COUDRE\n\ntest export \n zegeg\n Centre de documentation des autruches / Indeterminé / TES\n Prêt: 30/11/2017. \u001d!\u0001Retour: 21/12/2017 \u001d!\u0000\n______________________________________\n\n\n\u001dVA\u0000"}));
}

// Gestion d'évènements envoyés par le serveur
var socket = io();
socket.on('update', function (fn, args) {
    if (fn == 'delete') {
        document.getElementById('printer' + args).remove()
    }
})
