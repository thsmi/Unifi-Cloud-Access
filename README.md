# Unifi Cloud Access

Scripting a Unifi Device from the local networks is easily via their rest api. 
But sadly there is no such library available for the Cloud Access and most likely never will be. 

Because they use a very complex and complicated setup to create a point to point connection between
your browser and the unifi controller. Except for the handshake no data flows through their servers.

Their communication stack is basically an excursion though the complete world of web communication technologies. 
Starting with plain old REST, followed by REST with AWS Authorization Headers and WebSocket with AWS Request 
Authorization, which is then used by MQTT to negotiate a WebRTC data channel. This channel is used to transfer pseudo 
http request which emulate the client api...


... this is also why electron is the base for this project. You basically need support for every web technology 
implemented in a modern browser. And the only framework which provides this out of the box is a browser or something 
electron like. Theoretically it should be possible to reimplement it in other programming languages and frameworks but
it will be painful to configure all those dependencies. 

The Demo application manages only hotspot voucher but can be extended to basically everything. All API calls always 
tunneled via WebRTC by using the Cloud Access. There is no shortcut to use the rest api if you are connected to the 
local network.

This implementation is a prove of concept and is based on analyzing and reverse engineering the communication.

And you might ask your self. It it runs in Electron and is all JavaScript, so why don't you run it directly in your 
browser. And the sad answer is it is not possible it won't run in a browser, because the guys at Unifi screwed up
their Cross Site Scripting rules. The CORS rules are configured in such a strange way, that both firefox and chrome, 
throw cors errors when just opening the cloud access page....

# Releases

There are no official releases. If you want to use or try it, you need to build and package it by your own.

First use `npm install` to download all dependencies and then run the `package.bat` this will create a
electron based release in the build folder.
