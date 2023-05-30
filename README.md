# Unifi Cloud Access

Scripting a Unifi Device from the local networks is easily possible via their rest api. 
But sadly there is no such library available for the Cloud Access and most likely never will be. For more details refer to ...

This implementation tries to fill the gap. It is based on analyzing and reverse engineering the communication of the cloud access web application.

The Demo application manages voucher but can be extended to basically everything. API calls are just tunneled via WebRTC.

The whole setup is ridiculously complicated, and uses a vast amount of standard technologies to create a 
point to point connection. It is basically an excursion though the whole world of web communication technologies. 
Starting with plain old REST, followed by REST with AWS Authorization Headers and WebSocket with AWS Request 
Authorization, which is then used by MQTT to negotiate a WebRTC data channel. Which is used to transfer pseudo 
http request which emulate the client api.

This is also why electron is the base. You basically need support for every web technology implemented in a modern browser.
And the only framework which provides this out of the box is electron. It should be possible to reimplement it in other 
programming languages and frameworks. 

And no it won't run in a browser. This is mostly due to the strange Cross Site Scripting rules set by the Unifi server.
The CORS rules are configured in such a strange way, that both firefox and chrome, throw cors errors when just opening the 
cloud access page.
