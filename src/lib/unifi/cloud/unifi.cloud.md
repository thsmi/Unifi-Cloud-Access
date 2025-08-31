# Two Factor Authentication

The two factor authentication complicated the whole login process as we have not two login types.

The `UnifiCloudCookieAuthentication` which is technically a single factor authentication and just uses a cookie to do a re-authenticate.
The typical use case would be when you hit reload in your browser or open a link in new windows or tab. 
But seems to be completely unprotected and not bound to an endpoint. Which means whoever steals it can easily login without a password or any two factor authentication.

The `UnifiCloudPasswordAuthentication` is a classic username and password login to do an initial authentication. 
It used to be a single factor authentication but is now mandated to be a multi factor authentication. 

In any case you need to first authenticate either via the cookie or by password. 
After a successful login the multi-factor authentication starts. The cookie authentication will returns always a list containing only the non interactive authenticator, 
while the password authentication typically returns one or more interactive authenticators form which the 
user can choose the most preferred one.
