var appId = '',
	accountSid = '',
	authToken = '',
	twilio = require( 'twilio' ),
	express = require( 'express' ),
	bodyParser = require( 'body-parser' ),
	request = require( 'request' ),
	os = require( 'os' ),
	moment = require( 'moment-timezone' );

/**
 * Get upcoming arrivals for an array of stops.
 *
 * @param {array} stops
 * @param {function} callback
 */
function get_arrivals( stops, callback ) {
	// Convert the array of stops to a string
	var stopString = [].concat( stops ),
		path = 'http://developer.trimet.org/ws/V1/arrivals?locIDs=' + stopString + '&appId=' + appId + '&json=true';

	var r = request.get(
		{
			url: path
		},
	    function( error, response, body ) {
		    if ( error ) {
			    console.log( error );
		    } else {
			    respond( JSON.parse( body ), response, callback );
		    }
	    }
	);
}

/**
 * Respond via Twilio with the Trimet data.
 *
 * @param {object} data
 * @param {object} response
 * @param {function} callback
 */
function respond( data, response, callback ) {
	var arrivals = [];

	try {
		var results = data.resultSet.arrival;

		for ( var i = 0; i < results.length; i++ ) {

			var arrival = results[i].estimated;

			arrival = moment( arrival );
			arrival = results[i].route + ': ' + arrival.tz( 'America/Los_Angeles' ).format( 'h:mm a z' );

			arrivals.push( arrival );
		}
	} catch ( e ) {
		// Do nothing
	}

	callback.apply( null, [arrivals] );
}

// Create an express app
var app = express();
app.use( bodyParser.urlencoded() );

// Respond to Twilio posts
app.post( '/smsPost', function ( req, res ) {
	if ( twilio.validateExpressRequest( req, authToken ) ) {
		var to = decodeURIComponent( req.param( 'From' ) ),
			stopId = decodeURIComponent( req.param( 'Body' ) );

		stopId = parseInt( stopId, 10 );

		if ( isNaN( stopId ) ) {
			stopId = 0;
		}

		get_arrivals( [stopId], function ( arrivals ) {

			// Set up our text body
			var body = '';
			if ( undefined === arrivals || 0 === stopId || 0 === arrivals.length ) {
				body = 'Invalid stop ID.';
			} else {
				for ( var j = 0; j < arrivals.length; j++ ) {
					body += arrivals[j] + os.EOL;
				}

				var regex = '/' + os.EOL + '$/';

				body = body.replace( regex, '' );
			}

			// Now that we have arrivals, let's respond to the SMS
			var client = twilio( accountSid, authToken );
			var message = {
				body: body,
				to:   to,
				from: '+15039256266'
			};

			client.messages.create(
				message,
				function ( err, message ) {
					res.send( JSON.stringify( err ) );
				}
			);

			res.send( JSON.stringify( message ) );
		} );
	} else {
		res.send( 'Go away' );
	}
} );

app.listen( process.env.OPENSHIFT_NODEJS_PORT || 3000, process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1' );

// get_arrivals( '10712' );