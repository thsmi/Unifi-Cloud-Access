# Unifi WebRTC

On a local network you can access a Unifi Controller via a rest based api.

But Unifi Cloud Access does not provide a rest API for a very simple reason. They use a WebRTC Data Channel to directly connect your browser to your Unifi Device. The server is just a connection broker needed for the initial handshake. Everything else used a direct connection between the endpoints and thus a server side API would be useless.

WebRTC is designed for Realtime streaming between browser, used for sharing camera streams and screen casting in web meetings. It is build into all recent and modern browsers and was designed to use firewall piercing logic to bypass limiting NATs and firewalls. It offers channels for video and audio streams but also for data. 

Unifi cloud access uses such a data channel to send message to the Unifi Device's rest api.

A simple as this may sound, it is in reality a very complex and very hacky approach.

## WebRTC Handshake

WebRTC needs a signaling channel to negotiate the handshake between the endpoints. Technically your are free to use whatever you want. Unifi decided for some unknown reasons to use `MQTT over WebSockets` as signaling channel.

This leads to the following handshake Sequence.

### Connect to the websocket

Open a websocket connection and establish a MQTT 3.1 connection. 

Then subscribe to topics from `client/${identity}/` which is the Unifi Cloud Access. 
The identifier points to your Unifi Cloud Instance which owns you device.

### Handshake and Negotiation

For the handshake you need to create a new session. You do this by subscribing to the topic `client/${identity}/${device}/connect/${session}-1`. The session is a random UUID and the device is the device's unique UUID like identifier.

Then we start a new WebRTC Connection. The ice server urls as well as the credentials can be obtained from the Cloud Access Rest Api. Just request to create credentials and the result contains all credentials needed.

As next step the WebRTC Negotiation phase starts. We create an `offer` and publish it via the MQTT signaling channel to the topic `client/${identity}/device/${device}/connect/${session}-1"` the server forwards this to your Unifi device.

When ever WebRTC discovers a new ICE candidate you also publish it via MQTT to the previous url. Same happens vice versa when ever the Unifi device finds an possible ICE candidate it publishes it via the topic `client/${identity}/${device}/connect/${session}-1`. You then just add ice candidates proposed by the remote to your WebRTC Connection.

As soon as the remote found a suitable ICE candidate it will send an `answer` by publishing to the previous MQTT topic. This answer is the added to your connection. Which completes the handshake.

Finally when the connection reached the connected state we unsubscribe from the connect session topic.

The official WebRTC Home describes the typical [Connection Sequence](https://webrtc.org/getting-started/peer-connections-advanced) in detail.


## API calls via a WebRTC Data Channel

A WebRTC data channel is used to emulate the HTTP API calls between the client and the device. Unifi uses a proprietary data channel format to wrap the http calls.

The channel name has to start with "API" separated by a dash followed by a number. You can have multiple api channels in parallel as long as they don't have the same name.

Make sure you close the channel when not in use. Opening and closing is rather quick.


### WebRTC Api Data Channel Framing

Both Requests and Response use are made of a header and a body message. Thus an api is always a request header and body pair followed by a response header and body pair.

A header is always followed by a request body. Regardless of the body length. Which means e.g. for a HTTP GET, that you have to send an empty request body message after you send the request header.

The header and body payload of request is always compressed, while for responses neither header nor body is compressed.

Headers are transferred as JSON String while the payload is always binary or respectively a byte array.

So that you end up with the following four message sequence.

First the request header Message:

| Byte | Default | Description        |
|------|---------|--------------------|
| 0    |  0x01   | Type Header        |
| 1    |  0x01   | JSON               |
| 2    |  0x01   | COMPRESSED         |
| 3    |  0x00   | Unused             |
| 4-7  |  ...    | Payload Length     |
| 8... |  ...    | Compressed payload |

Followed by the request body Message

| Byte | Default | Description        |
|------|---------|--------------------|
| 0    |  0x02   | Type Body          |
| 1    |  0x03   | Binary             |
| 2    |  0x01   | COMPRESSED         |
| 3    |  0x00   | Unused             |
| 4-7  |  ...    | Payload Length     |
| 8... |  ...    | Compressed payload |

To which the remote responds with a header

| Byte | Default | Description        |
|------|---------|--------------------|
| 0    |  0x01   | Type Header        |
| 1    |  0x01   | JSON               |
| 2    |  0x00   | UNCOMPRESSED       |
| 3    |  0x00   | Unused             |
| 4-7  |  ...    | Payload Length     |
| 8... |  ...    | Compressed payload |

followed by a Body response

| Byte | Default | Description        |
|------|---------|--------------------|
| 0    |  0x02   | Type Body          |
| 1    |  0x03   | Binary             |
| 2    |  0x00   | UNCOMPRESSED       |
| 3    |  0x00   | Unused             |
| 4-7  |  ...    | Payload Length     |
| 8... |  ...    | Compressed payload |

# Headers

Headers are used emulate an http request, they contain all information of a "normal" Unifi API call.  The path pointing to the url api. A method which is either "GET" or "POST" as well as the HTTP headers. 

The path is absolute to the root, it does not contain a host or protocol e.g. "/proxy/network/api/s/default/cmd/hotspot".

Don't forget to set the content length HTTP Header to the uncompressed payload length. And don't include any HTTP headers for cookies or authentication. You are authenticated by the WebRTC data channel. 

Additionally each header has a unique `id`, which is typically a uuid. The id is used to match request and responses. Beside this the `type` field always set to `httpRequest`

Example GET Request Header Payload 
```` JSON
{
  "id": id,
  "type": "httpRequest",
  "path": "/proxy/network/api/s/default/stat/voucher",
  "method": "GET",
  "headers": {
    "content-length": 0
  }
};
````

Get Response Header Payload
```` JSON
````

Example POST Request Header Payload
```` JSON
{
  "id": id,
  "type": "httpRequest",
  "path": "/proxy/network/api/s/default/stat/voucher",
  "method": "POST",
  "headers": {
    "content-type": "application/json; charset=utf-8",
    "content-length": payload.byteLength
  }
};

````

POST Resonse Header Payload
```` JSON

```` 

### Payload

The API Payload is a JSON.
