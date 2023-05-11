'use strict';
//dgram for UDP
import dgram from 'dgram';
//express for HTTP
import express from 'express';
import net from 'net';
//Cors for Cross-Origin ressource sharing
import cors from 'cors';
import { Wertpapier, MSFT, LSFT } from './Wertpapier.mjs';
import { Socket } from 'dgram';



export class Bank {
    constructor(name, port) {
        this.name = name;
        this.portfolio = 0;
        this.wertpapiers = new Map();
        this.gain = 0;
        this.port = port;
        this.ipAddress = 'localhost';
    }




    calculatePortfolio() {
        var gesamtPort = 0;
        for (const [Wertpapier, count] of this.wertpapiers) {
            const sumWert = Wertpapier.preis * count;
            gesamtPort += sumWert;
        }
        this.portfolio = gesamtPort;
        return this.portfolio
    }




    addWertPapier(Wertpapier, count) {
        let exists = false;
        for (const [existingWertpapier, existingCount] of this.wertpapiers.entries()) {
            if (existingWertpapier.kurzel === Wertpapier.kurzel) {
                const newCount = existingCount + count;
                this.wertpapiers.set(existingWertpapier, newCount);
                exists = true;
                break;
            }
        }
        if (!exists) {
            this.wertpapiers.set(Wertpapier, count);
        }
        console.log(this.wertpapiers);
    }




    startServer() {
        //create a new udp socket (udp4 = ipv4)
        const server = dgram.createSocket('udp4');
        //event listener for message , emit when a new datagram is available on socket
        //msg: buffer containing the incoming message 
        //rinfo: containing sender's address, port, size of datagram
        server.on('message', (msg, rinfo) => {
            console.log(`Received data: ${msg.toString()}`);
            const parsedData = JSON.parse(msg.toString());
            this.receiveData(parsedData.wertpapier, parsedData.count);
            const responseBuffer = Buffer.from(`Received from Boerse: ${rinfo.address}, on port ${rinfo.port} ${parsedData.wertpapier.kurzel}, ${parsedData.count}`);
            //send a reponse back to client
            server.send(responseBuffer, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.log('Error sending response:', err);
                } else {
                    console.log("sent message to client");
                }
            });
        });
        //emit when the server is on (bound to an address and port, ready for listening)
        server.on('listening', () => {
            const address = server.address();
            console.log(`Bank server listening on ${address.address}:${address.port}`);
        });
        //server start listening for incoming data gram on port 3000
        server.bind(3000);
    }




    receiveData(Wertpapier, count) {
        this.addWertPapier(Wertpapier, count);
        console.log(`Received data from Boerse: ${Wertpapier.kurzel}, count: ${count}`);
        console.log(this.calculatePortfolio());
    }




    startHttpServer() {
        const server = net.createServer((socket) => {
            let requestData = '';
            socket.on('data', (data) => {
                requestData += data.toString();
                console.log("requested: " + requestData);
                // Check if the end of the headers has been reached
                const headerEndIndex = requestData.indexOf('\r\n\r\n');
                if (headerEndIndex !== -1) {
                    // Get the headers
                    const headers = requestData.substring(0, headerEndIndex).split('\r\n');
                    // Get the request line
                    const [method, path] = headers[0].split(' ');
                    // Get the Content-Length header
                    const contentLength = headers.find(header => header.startsWith('Content-Length: '));
                    if (contentLength) {
                        const length = parseInt(contentLength.split(': ')[1]);
                        // Check if all of the body has been received
                        const body = requestData.substring(headerEndIndex + 4);
                        if (body.length >= length) {
                            // All of the body has been received, handle the request
                            if (method === 'OPTIONS') {
                                this.handleOptionsRequest(socket);
                            }
                            // handle other methods...
                            else if (method === 'GET') {
                                this.handleGetRequest(socket, path, requestData);
                            } else if (method === 'POST') {
                                this.handlePostRequest(socket, path, requestData);
                            } else {
                                this.sendInvalidMethodResponse(socket);
                            }
                        }
                    }
                }
            });
        });
        server.listen(8080, () => {
            console.log('HTTP server listening on port 8080');
        });
    }
    
    




    handleGetRequest(socket, path, requestData) {
        if (requestData === null) {
            console.error("requestData is null");
            return;
        }
        const [requestLine, ...headerLines] = requestData.split('\r\n');
        //parse header:
        const headers = headerLines.reduce((acc, line) => {
            const [key, value] = line.split(': ');
            acc[key] = value;
            return acc;
        }, {});
        // Read request body based on Content-Length
        const contentLength = parseInt(headers['Content-Length'], 10);
        let requestBody = '';
        socket.on('data', (data) => {
            requestBody += data.toString();
            if (requestBody.length >= contentLength) {
                // Parse JSON data
                const jsonData = JSON.parse(requestBody);
                // Process JSON data based on the request path
                if (path === '/bank/addWertPapier') {
                    const { kurzel, count } = jsonData;
                    const wertpapier = this.getWertpapierByKurzel(kurzel);
                    if (wertpapier) {
                        this.addWertPapier(wertpapier, count);
                        this.sendJsonResponse(socket, { success: true });
                    } else {
                        this.sendJsonResponse(socket, { success: false, message: 'Invalid Wertpapier Kurzel' });
                    }
                } else {
                    this.sendInvalidPathResponse(socket);
                }
            }
        });
        //TODO:
    }

    handleOptionsRequest(socket) {
        const response = [
            'HTTP/1.1 200 OK',
            'Access-Control-Allow-Origin: *',
            'Access-Control-Allow-Methods: GET, POST, OPTIONS',
            'Access-Control-Allow-Headers: Content-Type',
            'Content-Length: 0',
            '\r\n'
        ].join('\r\n');
        socket.write(response);
    }
    


    getWertpapierByKurzel(kurzel) {
        // Add your logic to get Wertpapier by its Kurzel
        // This is just an example, you can implement it differently based on your requirements
        if (kurzel === 'MSFT') {
            return MSFT;
        } else if (kurzel === 'LSFT') {
            return LSFT;
        } else {
            return null;
        }
    }




    handlePostRequest(socket, path, requestData) {
        // console.log("request: " + requestData)
        if (requestData === null) {
            console.error("requestData is null");
            return;
        }
        const [requestLine, ...headerLines] = requestData.split('\r\n');
        // Parse headers
        const headers = headerLines.reduce((acc, line) => {
            const [key, value] = line.split(': ');
            acc[key] = value;
            return acc;
        }, {});
        // Read request body based on Content-Length
        const contentLength = parseInt(headers['Content-Length'], 10);
        const requestBody = requestData.split('\r\n\r\n')[1];
    
        // Check if there's extra data and remove it
        const jsonStartIndex = requestBody.indexOf('{');
        if (jsonStartIndex > 0) {
            requestBody = requestBody.substring(jsonStartIndex);
        }
    
        if (requestBody.length >= contentLength) {
            // Parse JSON data
            const jsonData = JSON.parse(requestBody);
            // Process JSON data based on the request path
            if (path === '/bank/addWertPapier') {
                const { kurzel, count } = jsonData;
                const wertpapier = this.getWertpapierByKurzel(kurzel);
                if (wertpapier) {
                    this.addWertPapier(wertpapier, count);
                    this.sendJsonResponse(socket, { success: true });
                } else {
                    this.sendJsonResponse(socket, { success: false, message: 'Invalid Wertpapier Kurzel' });
                }
            } else {
                this.sendInvalidPathResponse(socket);
            }
        }
    }
    
    

    sendJsonResponse(socket, data) {
        const jsonResponse = JSON.stringify(data);
        const response = [
            'HTTP/1.1 200 OK', // include HTTP version here
            'Content-Type: application/json',
            'Access-Control-Allow-Origin: *',  // Add this line
            'Access-Control-Allow-Methods: GET, POST, OPTIONS',  // Add this line
            'Access-Control-Allow-Headers: Content-Type',  // Add this line
            'Content-Length: ' + Buffer.byteLength(jsonResponse),
            '', // blank line required by HTTP protocol
            jsonResponse
        ].join('\r\n');
        socket.write(response);
    }
    
    




    sendInvalidMethodResponse(socket) {
        const response = 'HTTP/1.1 error 405 method not allowed \r\nContent: 0\r\n\r\n';
        socket.write(response, () => {
            socket.end();
        });
    }
}


//HTTP server code guideline, do not use
export function startHttpServer(bank) {
    const app = express();
    const port = 8080;
    app.use(express.json());
    // Add CORS middleware (cross-origin resource sharing)
    app.use(cors());
    app.get('/bank/portfolio', (req, res) => {
        res.json({ portfolio: bank.calculatePortfolio() });
    });
    app.post('/bank/addWertPapier', (req, res) => {
        const { kurzel, count } = req.body;
        const wertpapier = new Wertpapier(kurzel, 0);
        bank.addWertPapier(wertpapier, count);
        bank.calculatePortfolio();
        res.status(200).send('Added WertPapier');
    });
    app.listen(port, () => {
        console.log(`Bank HTTP server listening on port ${port}`);
    });
}


export const firstBank = new Bank('firstBank', 3000);


