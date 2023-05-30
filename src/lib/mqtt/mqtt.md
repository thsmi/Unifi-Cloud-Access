# MQTT

MQTT is a publish/subscribe protocol for IoT devices.
Which comes in two flavours. The basic one slim and transmitted directly over a raw tcp or udp port and can't be used by browsers. The way heavier flavour, uses a websocket as transport and is web browser compatible. Both use the very same messages and framing.

This is a very basic an non complete implementation.


## Data Formats

### Fixed length integers

### Variable length integers

### Pascal string
Basically a pascal string with a two byte prefix. The first two bytes
define the string length which is the followed by the string's bytes.


## Message Framing

Each message starts with an 4bit opcode defining the message type and 4 additional QoS flags.
It is followed by the payload size in bytes, it is variable length. 
The payload is normally prefixed by additional headers and properties.

## Connect message (0x1)

The connect message starts with the opcode 0x1 the QoS fields are set to 0.
Directly followed byte the payload size.

Then the protocol name and version number.
The protocol is a pascal string set to 'MQTT' and the version a fixed length one byte number set to 0x04 for MQTT 3.1

// TODO connection flags

After the connection flags the keep alive interval in seconds is specified.

Pascal string client id, normally random human readable alpha numeric id.
Followed by the username, which ubiquity abused to carry the implementation name.

## Connect Aknwoledge response (0x2)

The connect message is acknowledged by 0x2 message.

Length is always 2 bytes.

# Subscribe (0x)



## Subscribe Acknowledge resposne (0x5)
...

##





# Web Sockets

The websocket's protocol name needs to match the mqtt connection string. For MQTT 3.1 you use "4" in the connect message and "mqttv3.1" in the websocket's connect string.

