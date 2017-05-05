'use strict';
var AWS = require('aws-sdk');

/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
 * The Intent Schema, Custom Slots, and Sample Utterances for this skill, as well as
 * testing instructions are located at http://amzn.to/1LzFrj6
 *
 * For additional samples, visit the Alexa Skills Kit Getting Started guide at
 * http://amzn.to/1LGWsLG
 */


// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: title,
            content: output,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

/*{
  "type": "AudioPlayer.Play",
  "playBehavior": "string",
  "audioItem": {
    "stream": {
      "url": "string",
      "token": "string",
      "expectedPreviousToken": "string",
      "offsetInMilliseconds": 0c
    }
  }
}*/

function buildStopResponse() {
    return {
        /*"outputSpeech":{
            "type": "PlainText",
            "text": ""
        },
        "card":{
             type: 'Simple',
        title: 'title',
        content: 'output',
        },
        "reprompt":{
            "outputSpeech": {
                "type": "PlainText",
                "text": null 
            }
        },*/
        "directives": [{
            "type": "AudioPlayer.Stop"
        }],
        "shouldEndSession": true

    };
}

function buildPlayerResponse(url, token, offset, outputSpeech) {
    return {
        "outputSpeech": {
            "type": "PlainText",
            "text": outputSpeech
        },
        "directives": [{
            "type": "AudioPlayer.Play",
            "playBehavior": "REPLACE_ALL",
            "audioItem": {
                "stream": {
                    "url": url,
                    "token": url,
                    "offsetInMilliseconds": offset
                }
            }
        }],
        "shouldEndSession": true

    };
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome to No Agenda';
    const speechOutput = 'Welcome to the No Agenda Show. You can ask to play the latest episode, or start the live stream.';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, '', shouldEndSession));
}

function getHelpResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'No Agenda Help';
    const speechOutput = 'You can ask to play the latest episode, or start the live stream. You can ask to play the latest episode and skip to a specific time in the episode. Once you have started an episode, you can ask for your current timecode. While an episode is playing, you can ask to jump back thirty seconds.';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, '', shouldEndSession));
}

function handleSessionEndRequest(callback) {
    console.log("TEST TEST TEST");
    callback({}, buildSpeechletResponse("", "", '', true));
}

/**
 * Sets the color in the session and prepares the speech to reply to the user.
 */

function playNoAgenda(intent, session, callback) {
    var http = require('http');
    var url = "http://jakelstr.com/narss.php";
    var data = '';
    var request = http.get(url, function(response) {
        response.on('data', function(x) {
            data += x;
        });
        response.on('end', function() {
            data.replace("/@/g", "");
            data = JSON.parse(data);
            playAfterHTTPGet(intent, session, callback, data.channel.item[0].enclosure.attributes.url, data.channel.item[0].title);
        });
    });
}

function playAfterHTTPGet(intent, session, callback, naURL, naTitle) {
    var skipTimeSlot = intent.slots.SkipTime;
    if (skipTimeSlot.value) {
        console.log("skip time");
        var pattern = new RegExp('^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$', 'g');
        var match;
        var hour = 0;
        var minute = 0;
        var second = 0;
        var skipTimeSpeech = '';
        while ((match = pattern.exec(skipTimeSlot.value)) !== null) {
            if (match[6]) {
                hour = match[6];
                if (hour == 1) {
                    skipTimeSpeech += "1 hour, ";
                } else if (hour > 1) {
                    skipTimeSpeech += hour + " hours,";
                }
            }
            if (match[7]) {
                minute = match[7];
                if (minute == 1) {
                    skipTimeSpeech += "1 minute, ";
                } else if (minute > 1) {
                    skipTimeSpeech += minute + " minutes, ";
                }
            }
            if (match[8]) {
                second = match[8];
                if (second == 1) {
                    skipTimeSpeech += "1 second.";
                } else if (second > 1) {
                    skipTimeSpeech += second + " seconds.";
                }
            }
        }
        var milliseconds = (hour * 3600 * 1000) + (minute * 60 * 1000) + (second * 1000);

        callback({}, buildPlayerResponse(naURL, naTitle, milliseconds, "Playing No Agenda Show and skiping to " + skipTimeSpeech));
    } else {
        callback({}, buildPlayerResponse(naURL, naTitle, 0, "Playing No Agenda Show"));
    }
}

function playNoAgendaLive(intent, session, callback) {
    callback({}, buildPlayerResponse("https://listen.noagendastream.com/noagenda", "No Agenda Live Stream", 0, "Playing No Agenda Live"));
}


function pauseNoAgenda(intent, session, callback) {
    callback({}, buildStopResponse());
}

function currentPosition(intent, session, callback) {
    var dynamodb = new AWS.DynamoDB({
        apiVersion: '2012-08-10'
    });
    dynamodb.getItem({
        "TableName": 'NoAgendaPlayers',
        "Key": {
            "userId": {
                "S": session.user.userId
            }
        }
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            callback({}, buildSpeechletResponse('', "You don't appear to have a saved position for any episodes.", '', true));
        } else if (data.Item === undefined) {
            callback({}, buildSpeechletResponse('', "You don't appear to have a saved position for any episodes.", '', true));
        } else {
            var mills = parseInt(data.Item.position.S);
            console.log(mills);
            var hours = 0;
            var minutes = 0;
            var seconds = 0;
            while ((mills - (3600 * 1000)) >= 0) {
                hours++;
                mills = mills - (3600 * 1000);
            }
            while ((mills - (60 * 1000)) >= 0) {
                minutes++;
                mills = mills - (60 * 1000);
            }
            while ((mills - 1000) >= 0) {
                seconds++;
                mills = mills - 1000;
            }
            var timestamp = '';
            if (hours > 1) {
                timestamp += hours + " hours, ";
            }
            if (hours == 1) {
                timestamp += hours + " hour, ";
            }
            if (minutes > 1) {
                timestamp += minutes + " minutes, ";
            }
            if (minutes == 1) {
                timestamp += minutes + " minute, ";
            }
            if (seconds > 1) {
                timestamp += seconds + " seconds.";
            }
            if (seconds == 1) {
                timestamp += seconds + " second.";
            }
            callback({}, buildSpeechletResponse('No Agenda Show', "Your last saved position was " + timestamp, '', true));
        }
    });
}

function resumeNoAgenda(intent, session, callback) {
    var dynamodb = new AWS.DynamoDB({
        apiVersion: '2012-08-10'
    });
    dynamodb.getItem({
        "TableName": 'NoAgendaPlayers',
        "Key": {
            "userId": {
                "S": session.user.userId
            }
        }
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            playNoAgenda(intent, session, callback);
        } else if (data.Item === undefined) {
            playNoAgenda(intent, session, callback);
        } else {
            callback({}, buildPlayerResponse(data.Item.target.S, data.Item.target.S, data.Item.position.S, "OK"));
        }
    });
}

function jumpBack(intent, session, callback) {
    var dynamodb = new AWS.DynamoDB({
        apiVersion: '2012-08-10'
    });

    dynamodb.getItem({
        "TableName": 'NoAgendaPlayers',
        "Key": {
            "userId": {
                "S": session.user.userId
            }
        }
    }, function(err, data) {
        console.log(data);
        if (err) {
            // FIX
        } else if (data.Item === undefined) {
            // FIX
        } else {
            callback({}, buildPlayerResponse(data.Item.target.S, data.Item.target.S, (parseInt(data.Item.position.S) - 30000).toString(), "OK"));
        }
    });
    //callback({}, buildSpeechletResponse('', 'OK' , '', true));
}

// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    //console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    //console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;
    console.log(intentName);
    // Dispatch to your skill's intent handlers
    if (intentName === 'NoAgendaPlayIntent') {
        playNoAgenda(intent, session, callback);
    } else if (intentName === 'NoAgendaPlayLive') {
        playNoAgendaLive(intent, session, callback);
    } else if (intentName === 'NoAgendaCurrentPositionIntent') {
        currentPosition(intent, session, callback);
    } else if (intentName === 'NoAgendaJumpBackIntent' || intentName === 'AMAZON.PreviousIntent') {
        jumpBack(intent, session, callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getHelpResponse(callback);
    } else if (intentName === 'AMAZON.PauseIntent' || intentName === 'AMAZON.StartOverIntent') {
        pauseNoAgenda(intent, session, callback);
    } else if (intentName === 'AMAZON.ResumeIntent') {
        resumeNoAgenda(intent, session, callback);
    } else if (intentName === 'NoAgendaResumeIntent') {
        resumeNoAgenda(intent, session, callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        pauseNoAgenda(intent, session, callback);
    } else {
        console.log(intent);
        throw new Error('Invalid intent');
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    //console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    // Add cleanup logic here
}

function onPlaybackStopped(playbackStopRequest, context) {
    if (playbackStopRequest.token != "https://listen.noagendastream.com/noagenda") {
        var dynamodb = new AWS.DynamoDB({
            apiVersion: '2012-08-10'
        });
        dynamodb.putItem({
            TableName: 'NoAgendaPlayers',
            Item: {
                "userId": {
                    "S": context.System.user.userId
                },
                "position": {
                    "S": playbackStopRequest.offsetInMilliseconds.toString()
                },
                "target": {
                    "S": playbackStopRequest.token
                }
            }
        }, function(err, data) {
            if (err) {
                console.log(err, err.stack);
            }
        });
    }
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
    try {
        // console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);
        //console.log(event);
        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
             callback('Invalid Application ID');
        }
        */
        if (event.session) {
            if (event.session.new) {
                onSessionStarted({
                    requestId: event.request.requestId
                }, event.session);
            }
        }
        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        } else if (event.request.type === 'AudioPlayer.PlaybackStopped') {
            onPlaybackStopped(event.request, event.context)
        }
    } catch (err) {
        callback(err);
    }
};