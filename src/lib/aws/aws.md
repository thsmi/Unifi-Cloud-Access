# Amazon Signed Requests

In order to connect to Amazon Web Services you need to authenticate you request.
This is done by adding a special signature to your request's header or to the query.

Details can be found here:
* https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
* https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html#calculate-signature
* https://github.com/mhart/aws4/blob/master/aws4.js
* https://virtualbrakeman.wordpress.com/2017/02/13/aws-rest-api-authentication-using-node-js/
