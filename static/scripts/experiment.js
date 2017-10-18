// Settings
var PPU = 5; // Pixels per base unit.
var xMax = 100; // Maximum size of a bar in base units.
var trialIndex = -1;
var enter_lock = true;
var abandonment_signal = 0;
var ready_signal = 0;
var reset_signal = 'Reset';
var websocket_signal = 0;
var partner_accept_type = 0;
var waiting_for_partner = 0;
var partner_node_id = -1;
var partner_guess_record = NaN;

// Set a series of timeouts (in seconds).
var stimulus_timeout = 1; // Time for which a stimulus is displayed.
var wait_time = 2; // Time between stimulus viewing and response.
var correction_timeout = 2; // Time for which the correction is displayed.
var response_timeout = 2; // Time for which a response is allowed.
var partner_change_announcement = 2; // Time for which the partner's change announcement is displayed.
var inter_trial_time = 5; // Time to wait between trials.
var abandonment_timer = 60; // Time to wait before kicking someone out.
var abandonment_announcement = 5; // Time to wait before moving forward after being abandoned.
var finalize_cutoff = 3; // Number of times to check for finalization.
var waiting_for_partner_timeout = 5 * 60; // Time to wait before showing opt-out button.

// Set training information.
var trainN = 10; // Define number of training trials.
var testN = 15; // Define number of test trails (over training trials).
var totalN = trainN + testN + 1; // Summing training and test trials (plus one for experiment mechanics).
var trial_correct_error = 4; // Acceptable difference for correct answer in training.

// Specify location information for stimuli, responses, and buttons.
var inset = 1;
var stimulus_x_start = 50;
var stimulus_y_start = 150;
var stimulus_bg_width = 500;
var stimulus_bg_height = 25;
var response_x_start = 100;
var response_y_start = 350;
var response_bg_width = 500;
var response_bg_height = 25;
var partner_y_start = response_y_start + 100; // 450
var partner_x_start = response_x_start;
var correction_y_start = response_y_start - 100; // 250
var correction_x_start = response_x_start;
var change_guess_y = partner_y_start + 200;
var change_guess_x = response_x_start;
var accept_guess_y = partner_y_start + 200;
var accept_guess_x = response_x_start * 3;

// Specify colors for own, partner, and stimulus boxes.
var partner_guess_color = '#0b6b13';
var own_guess_color = '#0B486B';
var stimulus_color = '#b32113';
var correction_color = '#8e8e8e';

// Create the websocket channel to serve as an inter-trial waiting room.
var channel = 'experiment';
var ws_scheme = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
var socket = new ReconnectingWebSocket(ws_scheme + location.host + '/chat?channel=' + channel);

// Check for incoming messages.
socket.onmessage = function (msg) {

    // Prevent us from clogging up the log with errors from empty messages.
    if (Object.keys(msg.data.substring(channel.length + 1)).length > 0){

        // The message is prefixed with the channel name and a colon.
        ready_signal_data = JSON.parse(msg.data.substring(channel.length + 1));

        // Identify the ready signal and the sender.
        next_signal = Object.values(ready_signal_data)[0];
        next_sender = Object.keys(ready_signal_data)[0];

        // If we received a signal, let us know what it was.
        if (next_sender == partner_node_id){
            console.log("Partner's signal: " + next_signal);
        }

        // If the websocket reads the abandonment signal, terminate the experiment.
        websocket_signal = next_signal;
        if (next_signal==-99) {

            // Differentiate between whether the participant or their partner abandoned.
            if (next_sender == partner_node_id){

                // If their partner abandoned it, go to the postquestionnaire.
                $('#title').text('Your partner has abandoned the experiment.');
                $('.instructions').text('You will receive base pay and any earned bonuses.');
                setTimeout( function () {
                    sendDataToServer();
                    allow_exit();
                    go_to_page('postquestionnaire');
                }, abandonment_announcement*1000);

            } else {

                // If the participant abandoned it, go to debriefing.
                $('#title').text('You have abandoned the experiment.');
                $('.instructions').text('You will receive only your base pay.');
                setTimeout( function () {
                    sendDataToServer();
                    allow_exit();
                    go_to_page('debriefing');
                }, abandonment_announcement*1000);
            }
        // If it's a reset signal, reset the current ready signals.
        } else if (next_signal == 'You left!') {

            // If the partner abandoned it, go to debriefing.
            $('#title').text('You have abandoned the experiment.');
            $('.instructions').text('You will receive only your base pay.');
            setTimeout( function () {
                sendDataToServer();
                allow_exit();
                go_to_page('debriefing');
            }, abandonment_announcement*1000);

        // If it's a reset signal, reset the current ready signals.
        } else if (next_signal == 'Reset') {

            current_ready_signals = 0;
            partner_ready_signal = 0;
            console.log('Ready signals reset.');

        // If one partner detects that they've been hanging, fix it.
        } else if (next_signal == 'Hanging') {

          current_ready_signals = 2;
          console.log('Correcting a hanging trial.');

        // Otherwise, just sum it.
        } else {

            // Let us know if our partner sent it.
            if (next_sender == partner_node_id){
               partner_ready_signal = next_signal;
            }

            // Sum all ready signals.
            current_ready_signals = current_ready_signals + next_signal;
            console.log('Current ready signals: '+ current_ready_signals);

        }
    }
};

// Create the agent.
function create_agent () {
    reqwest({
        url: '/node/' + participant_id,
        method: 'post',
        type: 'json',
        success: function (resp) {
            my_node_id = resp.node.id;
            check_for_partner();
        },
        error: function (err) {
            console.log('Error when initializing participant: '+ err);
            $('#title').text('An error has occurred.');
            $('.instructions').text('Please close this window and return this HIT.');
            err_response = JSON.parse(err.response);
            if (err_response.hasOwnProperty('html')) {
                $('body').html(err_response.html);
                 allow_exit();
                 go_to_page('debriefing');
            }
        }
    });
};

//
// Monitor for the participant to be joined with a partner.
//
function check_for_partner () {

    reqwest({
        url: '/node/' + my_node_id + '/vectors',
        method: 'get',
        type: 'json',
        success: function (resp) {
            vectors = resp.vectors;

            // Ask for all my vectors.
            if (vectors.length > 0) {
                // if there are vectors, go through their origin_ids
                // whichever origin id is not the same as your node_id,
                // or the origin id of the source (1),
                // that must be your partner's id.
                console.log('Partner node ID: ' + partner_node_id);
                for (i = 0; i < vectors.length; i++) {
                    if ((vectors[i].origin_id !== my_node_id) && vectors[i].origin_id !== 1) {
                        partner_node_id = vectors[i].origin_id;
                        console.log('Partner node ID: ' + partner_node_id);
                    }
                };
                // Now that you've identified your partner, move on.
                get_received_info();
            } else {

                // If there are no vectors, wait 1 second and then ask again
                setTimeout(function () {
                    waiting_for_partner = waiting_for_partner + 1;
                    check_for_partner();
                }, 1000);

                // If they've been waiting a long time for a partner, give them an option to leave.
                if (waiting_for_partner > waiting_for_partner_timeout){
                    mercy_button = "<input type='button' class='btn btn-secondary btn-lg' id='mercyButton' value='Opt out (or broken)' style='position:absolute;top:" + partner_y_start + "px;left:" + partner_x_start + "px;'>";
                    $(document).unbind('click');
                    $(document).off('click');
                    $('body').append(mercy_button);
                    $('#mercyButton').click(function () {
                      console.log('Leaving without being paired.')
                      allow_exit();
                      go_to_page('debriefing');
                    });
                }
            }
        },
        error: function (err) {
            console.log('Error when attempting to identify partner: '+ err);
            $('#title').text('An error has occurred.');
            $('.instructions').text('Please close this window and return this HIT.');
        }
    });
};

//
// Connect them to their partner.
//
function get_received_info () {
    reqwest({
        url: '/node/' + my_node_id + '/received_infos',
        method: 'get',
        type: 'json',
        success: function (resp) {
            r = resp.infos[0].contents;
            int_list = JSON.parse(r);
            $('#title').text('Partner found and connected');
            $('.instructions').text('Press enter to begin');
            enter_lock = false;

            // Remove the button, if it's there.
            if (waiting_for_partner > waiting_for_partner_timeout) {
                waiting_for_partner = 0;
                $('#mercyButton').remove();
            }
        },
        error: function (err) {
            console.log('Error when checking if partner is connected: ' + err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
    });
};


//
// Draw the user interface.
//
function drawUserInterface () {

    paper = Raphael(0, 50, 800, 600);

    // Create the stimulus background.
    stimulus_background = paper.rect(stimulus_x_start,
                                     stimulus_y_start,
                                     stimulus_bg_width,
                                     stimulus_bg_height-2*inset);
    stimulus_background.attr('stroke', '#CCCCCC');
    stimulus_background.attr('stroke-dasharray', '--');
    stimulus_background.hide();

    // Draw the stimulus bar with the next line length in the list.
    stimulus_bar = paper.rect(stimulus_x_start,
                              stimulus_y_start-inset,
                              0,
                              25);
    stimulus_bar.attr('fill', stimulus_color);
    stimulus_bar.attr('stroke', 'none');
};

//
// Move to next trial: Increment trial number, display stimulus, and allow response.
//
function proceedToNextTrial () {

    // Increment the trial and guess counter.
    trialIndex += 1;
    guessCounter = -1;
    response_counter = -1;
    partner_response_counter = 0;
    acceptType = 0;
    partner_accept_type = 0;
    current_ready_signals = 0;
    wait_for_partner_guess = 0;
    final_accuracy = 0;
    reset_signal = 'Reset';

    // Identify whether we're in training or testing.
    if (trialIndex < trainN) {
        trialType = 'train';
    } else {
        trialType = 'test';
    }

    // Move to next trial if we haven't hit our target n.
    if ((trialIndex + 1) < totalN) {

        // Update announcements and current trial info.
        $('#title').text('Beginning next round');
        $('.instructions').text('');
        console.log('BEGINNING TRIAL ' + trialIndex);

        setTimeout(function () {
            // Prevent repeat keypresses.
            Mousetrap.pause();

            // Reveal stimulus for set amount of time.
            console.log('Stimulus width: ' + int_list[trialIndex]);
            $('#title').text('Remember this line length.');
            $('.instructions').text('');
            stimulus_background.show();
            stimulus_bar.show().attr({ width: int_list[trialIndex]*PPU });

            // Allow response only for a limited amount of time.
            var unresponsiveParticipant;
            setTimeout(waitToGuess,
                     stimulus_timeout*1000);
            setTimeout(allowResponse,
                     (stimulus_timeout + wait_time)*1000);

        }, inter_trial_time * 1000);

        // If this is a training trial...
        if (trialType == 'train') {

          // Update header for participant.
          $('#training-or-testing').html('Training');
          $('#total-trials').html(trainN);
          $('#trial-number').html(trialIndex + 1);

        // ... or if this is a test trial ...
        } else {

          // Update header for participant.
          $('#training-or-testing').html('Testing');
          $('#total-trials').html(testN);
          $('#trial-number').html(trialIndex + 1-trainN);

        }

    // ... or if we're done, finish up.
    } else {

        // Send data back to the server and proceed to questionnaire.
        paper.remove();
        allow_exit();
        go_to_page('postquestionnaire');

    }
};

//
// For training trials, show the correct length.
//
function showCorrectLength () {

    // Draw correction background.
    correction_background = paper.rect(correction_x_start,
                                       correction_y_start,
                                       response_bg_width,
                                       response_bg_height - 2 * inset);
    correction_background.attr('stroke', '#CCCCCC');
    correction_background.attr('stroke-dasharray', '--');

    // Draw correction bar.
    correction_bar = paper.rect(correction_x_start,
                                correction_y_start - inset,
                                response_bg_width,
                                response_bg_height);
    correction_bar.attr('fill', correction_color);
    correction_bar.attr('stroke', 'none');
    correction_bar.attr({x: correction_x_start,
                         width: int_list[trialIndex]*PPU});

    // Show labels.
    correction_label = paper.text(correction_x_start + 10,
                                  correction_y_start - inset + 50,
                                  'Correct length');
    correction_label.attr({'font-family':  'Helvetica Neue,Helvetica,Arial,sans-serif',
                           'font-size': '14px',
                           'text-anchor': 'start'});
    own_label = paper.text(response_x_start + 10,
                           response_y_start - inset + 50,
                           'Your guess');
    own_label.attr({'font-family':  'Helvetica Neue,Helvetica,Arial,sans-serif',
                    'font-size': '14px',
                    'text-anchor': 'start'});

    // Show the participant's guess.
    response_background.show();
    response_bar.show();
    own_label.show();
    correction_bar.show();
    correction_bar.show();
    correction_label.show();
    if (response == -99){
        response_bar.attr({x:response_x_start,
                           width: 0});
    } else {
        response_bar.attr({x:response_x_start,
                           width: response*PPU});
    }

    // Update text to reflect accuracy.
    if (Math.abs(response - int_list[trialIndex]) < trial_correct_error) {
        $('#title').text('Your guess was correct!');
        $('.instructions').text('The blue bar is your guess; the grey bar is the correct answer.');
    } else if (response == -99){
        $('#title').text("You didn't respond in time");
        $('.instructions').html('Make sure to respond within ' + response_timeout + ' seconds.<br>The grey bar is the correct answer.');
    } else {
        $('#title').text('Your guess was incorrect');
        $('.instructions').text('The blue bar is your guess; the grey bar is the correct answer.');
    }
};

//
// Send the data back to the server.
//
function sendDataToServer () {

    // Handle reset signals to yoke participants to same trial.
    if (reset_signal=='Reset'){
        response_type = 0;
        trialData = JSON.stringify({'trialType': trialType,
                                    'trialNumber': trialIndex,
                                    'guessCounter': guessCounter,
                                    'responseCounter': response_counter,
                                    'length': int_list[trialIndex],
                                    'guess': response,
                                    'acceptType': 0,
                                    'finalAccuracy': final_accuracy,
                                    'responseType': response_type});
    } else {
        response_type = 1;
        trialData = JSON.stringify({'trialType': trialType,
                                    'trialNumber': trialIndex,
                                    'guessCounter': guessCounter,
                                    'responseCounter': response_counter,
                                    'length': int_list[trialIndex],
                                    'guess': response,
                                    'acceptType': acceptType,
                                    'finalAccuracy': final_accuracy,
                                    'responseType': response_type});
    }

    // Prepare data to send to server.
    console.log('Accept type: ' + acceptType);
    console.log('Logged guess: ' + response);

    // If someone abandoned, just send the data and let the abandonment function proceed.
    reqwest({
        url: '/info/' + my_node_id,
        method: 'post',
        data: {
            contents: trialData,
            property3: final_accuracy
        }, success: function(resp) {
            if ((websocket_signal != -99) && ((trialIndex + 1) == totalN)) {
                create_agent();
            }
        }
    });
};

//
// Wait between trials.
//
function waitToGuess () {

    // Hide stimulus bar and text.
    stimulus_bar.hide();
    stimulus_background.hide();
    $('#title').text('');
    $('.instructions').text('');
};

//
// Allow user response only for a set number of seconds.
//
function allowResponse () {

    // Create response background.
    response_background = paper.rect(response_x_start,
                                     response_y_start,
                                     response_bg_width,
                                     response_bg_height-2*inset);
    response_background.attr('stroke', '#CCCCCC');
    response_background.attr('stroke-dasharray', '--');
    response_background.show();

    // Draw response bar.
    response_bar = paper.rect(response_x_start,
                              response_y_start-inset,
                              response_bg_width,
                              response_bg_height);
    response_bar.attr('fill', own_guess_color);
    response_bar.attr('stroke', 'none');

    // Display response bar and reset instructions.
    $('#title').text('Re-create the line length.');
    $('.instructions').text('');
    response_bar.show().attr({width: 0});

    // Set the response variable to default and increment guess counter.
    acceptType = 0;
    guessCounter = guessCounter + 1;
    response_counter = response_counter + 1;

    // Track the mouse during response.
    Mousetrap.pause();
    $(document).mousemove(trackMouseMovement);

    // Monitor for an unresponsive participant.
    unresponsiveParticipant = setTimeout(disableResponseAfterDelay,
                                         response_timeout*1000);

    // If they click to submit a response, clear the timeout and update the site text.
    acknowledge_lock = false;
    $(document).click(acknowledgeGuess);
};

//
// Acknowledge participant guess.
//
function acknowledgeGuess(){

    // Only allow them to guess in certain settings.
    if (acknowledge_lock === false){

        // Register response and hide bars.
        response = Math.round(response_bar_size/PPU);
        sendDataToServer();
        console.log('Mouse click: ' + response);
        response_bar.hide();
        response_background.hide();

        // Stop the timer if we click.
        $(document).click(function(e) { e.stopPropagation(); });

        // Reset for next trial.
        Mousetrap.resume();

        // Stop the unresponsive timer and prevent multiple guesses.
        clearTimeout(unresponsiveParticipant);
        $(document).off('mousemove',trackMouseMovement);
        $(document).off('click');

        // If a training trial, display correction; if test, update text.
        if (trialType == 'train'){

            // Display correct length.
            showCorrectLength();

            // If this is the last training trial, prepare them for test trials.
            if (trialIndex == (trainN-1)) {
                setTimeout(function() {
                    // Get the bars to disappear after the correct time.
                    response_bar.hide();
                    response_background.hide();
                    own_label.hide();
                    correction_bar.hide();
                    correction_background.hide();
                    correction_label.hide();

                    // Update the text.
                    $('#title').text("Congrats! You've finished the training trials");
                    $('.instructions').html('Your next trial will be a <b>test</b> trial.');
                }, correction_timeout*1000);

                // Move to next trial.
                setTimeout(function () {
                    $('#title').text('');
                    $('.instructions').html('');
                    checkPartnerTraining();
                }, 5000 + (correction_timeout*1000));

            } else {
                // If it's not the last training trial, clean up and advance to next turn.
                setTimeout(function() {
                    response_bar.hide();
                    response_background.hide();
                    own_label.hide();
                    correction_bar.hide();
                    correction_background.hide();
                    correction_label.hide();

                    // Move on to the next trial.
                    proceedToNextTrial();
                }, correction_timeout*1000);
            }
      } else {
        // Wait for partner to guess.
        $('#title').text('Your response has been recorded.');
        $('.instructions').text("Please wait for your partner's guess.");
        setTimeout(getPartnerGuess, 1000);
      }
      // Only allow them to acknowledge once.
      acknowledge_lock = true;
    }
}

//
// Disable participant responses if they take too long.
//
function disableResponseAfterDelay () {

    // Turn off click ability and event listeners.
    $(document).off('click');
    $(document).off('mousemove',trackMouseMovement);

    // Hide response bars.
    response_bar.hide();
    response_background.hide();

    // Log response as not having been given.
    response = -99;
    sendDataToServer();

    // Show the correct length if we're in training.
    if (trialType == 'train') {

        // Display correct length.
        showCorrectLength();

        // If this is the last training trial, prepare them for test trials.
        if (trialIndex == (trainN-1)) {
            setTimeout(function() {

                // Get the bars to disappear after the correct time.
                response_bar.hide();
                response_background.hide();
                own_label.hide();
                correction_bar.hide();
                correction_background.hide();
                correction_label.hide();

                // Update the text.
                $('#title').text("Congrats! You've finished the training trials");
                $('.instructions').html('Your next trial will be a <b>test</b> trial.');

            }, correction_timeout*1000);

            // Move to next trial.
            setTimeout(function () {
                $('#title').text('');
                $('.instructions').html('');
                checkPartnerTraining();
                waiting_for_partner = 0;
            }, 5000 + (correction_timeout*1000));

        } else {

            // If it's not the last training trial, clean up and advance to next turn.
            setTimeout(function() {
                response_bar.hide();
                response_background.hide();
                own_label.hide();
                correction_bar.hide();
                correction_background.hide();
                correction_label.hide();

                // Move on to the next trial.
                proceedToNextTrial();
            }, correction_timeout*1000);
        }

    // Just update the text if we're in a test trial.
    } else {
        $('#title').text('Response period timed out.');
        $('.instructions').text("Please wait for your partner's guess.");
        getPartnerGuess();
    }
};

//
// Track mouse movement during response.
//
 function trackMouseMovement (e) {
    currentXLocation = e.pageX-response_x_start;
    response_bar_size = bounds(currentXLocation,
                               1*PPU,
                               xMax*PPU);
    response_bar.attr({ x: response_x_start,
                        width: response_bar_size });
};

//
// Wait for partner to finish training.
//
function waitForTraining () {

    // Keep track of how long we've been waiting.
    waiting_for_partner = waiting_for_partner + 1;

    // Update text and check again.
    $('#title').text('Please wait');
    $('.instructions').text('Your partner is finishing training');
    setTimeout(checkPartnerTraining,1000);
};

//
// Wrap up if partner abandons.
//
function handleAbandonedPartner () {

    // Inform player about what happened.
    $('#title').text('Your partner has abandoned the experiment.');
    $('.instructions').text('You will receive base pay and any earned bonuses.');

    // Send a signal, in case partner is still listening.
    sendReadySignal('You left!');

    // Move on.
    setTimeout( function () {
        allow_exit();
        go_to_page('debriefing');
    }, abandonment_announcement*1000);
};

//
// Check whether our vectors have failed (i.e., partner abandoned/returned HIT).
//
function checkFailedVectors () {
    reqwest({
        url: '/node/' + my_node_id + '/vectors',
        method: 'get',
        type: 'json',
        success: function (resp) {
            vectors = resp.vectors;
            if (vectors.length===1) { handleAbandonedPartner(); }
        },
        error: function (err) {
            console.log('Error when attempting to check for failed node: '+ err);
            $('#title').text('An error has occurred.');
            $('.instructions').text('Please close this window and return this HIT.');
        }
    });
};

//
// Montior the server to see if their partner's finished training.
//
function checkPartnerTraining () {

    reqwest({
        url: '/node/' + partner_node_id + '/infos',
        method: 'get',
        type: 'json',
        success: function (resp) {

            // Make sure our partner is still connected.
            checkFailedVectors();

            // Loop back if this is the first trial and the partner hasn't guessed.
            if (resp.infos.length === 0) {
              waitForTraining();

            // If we've been waiting forever, kick us to debrief.
            } else if (waiting_for_partner > waiting_for_partner_timeout) {
                handleAbandonedPartner();
            } else {

                // Grab partner's guess.
                fetchPartnerData();
                partner_guess_trial = partner_guess_record['trialNumber'];

                // If the partner has finished training, move on.
                if (partner_guess_trial >= (trainN-1)){
                    $('#title').text('');
                    $('.instructions').text('');
                    proceedToNextTrial();

              // Loop back if the partner hasn't finished training.
                } else {
                    waitForTraining();
                }
            }
        },
        error: function (err) {
            console.log('Error when trying to see if partner finished training: ' + err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
    });
};

//
// Check to see if partner has guessed one time per second.
//
function waitForGuess () {

    // Increment wait timer.
    wait_for_partner_guess = wait_for_partner_guess + 1;

    // Then try again.
    setTimeout(getPartnerGuess, 1000);
};

//
// Monitor the server to see if partner has guessed.
//
function getPartnerGuess () {

    // Get partner's data.
    fetchPartnerData();

    // If partner hasn't responded, wait.
    if (partner_guess_record==NaN) {
        waitForGuess();

    // Move forward if the partner has guessed.
    } else {

        // Derive guess information from data.
        partner_guess_trial = partner_guess_record['trialNumber'];
        partner_response_counter = partner_guess_record['responseCounter'];
        partner_accept_type = partner_guess_record['acceptType'];
        console.log("Partner's current trial: " + partner_guess_trial);

        // If we're on same trial and response numbers...
        if ((partner_guess_trial === trialIndex) && (partner_response_counter === response_counter)){

            // ... see if we can move on if we've both accepted.
            if (partner_accept_type===1 && acceptType===1){
                checkIfPartnerAccepted();

            // .. go back if we haven't both accepted.
            } else {
                enter_lock = false;
                partner_x_guess = partner_guess_record['guess'];
                wait_for_partner_guess = 0;
                showPartner();
            }

        // If we've been waiting too long AND we're behind on the response counter, try to grab the partner's guess anyway.
        } else if ((partner_guess_trial === trialIndex) && (wait_for_partner_guess > 20)){
            enter_lock = false;
            partner_x_guess = partner_guess_record['guess'];
            wait_for_partner_guess = 0;
            showPartner();

        // If the partner has somehow gone onto the next trial, move on, too.
        } else if (partner_guess_trial > trialIndex) {
            proceedToNextTrial();

        // If the partner has somehow finished the experiment, move on, too.
        } else if ((partner_guess_trial === testN) && (partner_accept_type==1) &&  (wait_for_partner_guess > 20)) {
            proceedToNextTrial();

        // If partner hasn't guessed, wait.
        } else {
            waitForGuess();
        }
    }
};

//
// Display partner's guess.
//
function showPartner () {

    // When we show our partner's guess, send out a signal to prevent them from moving on.
    reset_signal = 'Reset';
    socket.send(channel + ':' + JSON.stringify(reset_signal));
    sendDataToServer();

    // Reset the ready signals when we display our partner.
    current_ready_signals = 0;
    ready_signal = 0;
    partner_ready_signal = 0;
    tried_to_finalize = 0;

    // Start the abandonment timer.
    var abandoned_participant;
    abandoned_participant = setTimeout(monitorForAbandoned,
                                       abandonment_timer*1000);

    // Initialize change button.
    change_guess_button = "<input type='button' class='btn btn-secondary btn-lg' id='changeGuess' value='Change my guess' style='position:absolute;top:" + change_guess_y + "px;left:" + change_guess_x + "px;'>";
    $('body').append(change_guess_button);
    $(document).unbind('click');
    $(document).off('click');

    // If they change their guess, stop the abandonment timer and allow to change.
    $('#changeGuess').click(function () {
        $(document).click(function(e) { e.stopPropagation(); });
        clearTimeout(abandoned_participant);
        changeOwnGuess();
    });

    // Show both guesses.
    showOwnGuess();
    showPartnerGuess();

    // If nobody guesses, ask them to go back and guess.
    if (partner_x_guess < 0 && response < 0) {

        $('#title').text('Neither you nor your partner submitted a guess.');
        $('.instructions').text("Please submit your guess by clicking 'Change my guess'.");

    // If they guessed, allow them to accept it.
    } else {

        // If someone submitted a guess, allow them to accept.
        accept_guess_button = '<input type="button" class="btn btn-secondary btn-lg" id="acceptGuess" value="I\'m done" style="position:absolute;top:' + accept_guess_y + 'px;left:' + accept_guess_x + 'px;">';

        // Show updated instructions based on whether they or their partner changed their guess.
        if (response_counter===0){
          $('#title').text('Would you like to accept your guess or change it?');
        } else { // We've already identified partner_accept_type in the enclosing function.
            if (partner_accept_type===0 && acceptType===1){
              $('#title').html('Your partner chose to change their guess.<br>Would you like to accept your guess or change it?');
            } else if (partner_accept_type===1 && acceptType===0){
              $('#title').html('Your partner did not choose to change their guess.<br>Would you like to accept your guess or change it?');
            } else if (partner_accept_type===0 && acceptType===0){
              $('#title').html('Your partner also chose to change their guess.<br>Would you like to accept your guess or change it?');
            }
        }
        $('.instructions').text("Your guess is shown in blue, and your partner's guess is shown in green.");

        // If they submitted a guess, allow them to accept it and stop the abandonment timer.
        $('body').append(accept_guess_button);
        $('#acceptGuess').click(function() {
            $(document).click(function(e) { e.stopPropagation(); });
            clearTimeout(abandoned_participant);
            acceptOwnGuess();
        });
    }
};

//
// Draw partner's guess.
//
function showPartnerGuess () {

    // Draw partner's background.
    paper = Raphael(0, 50, 800, 600);
    partner_background = paper.rect(partner_x_start,
                                    partner_y_start,
                                    response_bg_width,
                                    response_bg_height - 2 * inset);
    partner_background.attr('stroke', '#CCCCCC');
    partner_background.attr('stroke-dasharray', '--');

    // Draw partner's guess.
    partner_bar = paper.rect(partner_x_start,
                             partner_y_start - inset,
                             response_bg_width,
                             response_bg_height);
    partner_bar.attr('fill', partner_guess_color);
    partner_bar.attr('stroke', 'none');
    if (partner_x_guess > 0){
        partner_bar.show().attr({x: partner_x_start,
                                 width: partner_x_guess*PPU});
    } else {
        partner_bar.show().attr({x: partner_x_start,
                                 width: 0});
    }

    // Label the bar.
    partner_label = paper.text(partner_x_start + 10,
                               partner_y_start - inset + 50,
                               "Your partner's guess");
    partner_label.attr({'font-family':  'Helvetica Neue,Helvetica,Arial,sans-serif',
                        'font-size': '14px',
                        'text-anchor': 'start'});
};

//
// Show own guess.
//
function showOwnGuess () {

    // Turn off mousetracking.
    $(document).off('mousemove',trackMouseMovement);

    // Fill in the response bar if they responded.
    response_background.show();
    if (response > 0) {
        response_bar.show().attr({x: response_x_start,
                                  width: response*PPU});
    } else {
        response_bar.show().attr({x: response_x_start,
                                width: 0});
    }

    // Label the bar.
    own_label = paper.text(response_x_start + 10,
                           response_y_start - inset + 50,
                           'Your guess');
    own_label.attr({'font-family':  'Helvetica Neue,Helvetica,Arial,sans-serif',
                    'font-size': '14px',
                    'text-anchor': 'start'});
};

//
// Accept own guess.
//
function acceptOwnGuess () {

    // Remove partners' guesses and buttons.
    reset_signal = 'Submitted';
    partner_background.hide();
    partner_bar.hide();
    partner_label.hide();
    response_background.hide();
    response_bar.hide();
    own_label.hide();
    $('#acceptGuess').remove();
    $('#changeGuess').remove();

    // Reset text.
    $('#title').text('Please wait...');
    $('.instructions').text('Checking to see if your partner has responded.');

    // Note whose guess we accepted and send data.
    acceptType = 1;
    ready_signal = 1;
    response_counter = response_counter + 1;
    sendReadySignal(ready_signal);
    sendDataToServer();

    // Start next trial.
    checkIfPartnerAccepted();
};

//
// Send websocket ready signal.
//
function sendReadySignal (signal_value) {
    signal_data = {};
    signal_data[my_node_id] = ready_signal;
    socket.send(channel + ':' + JSON.stringify(signal_data));
};

//
// Change guess.
//
function changeOwnGuess () {

  // Add a brief timeout between pressing button and allowing the change.
  setTimeout(function () {

        // Remove buttons and update text.
        $('#acceptGuess').remove();
        $('#changeGuess').remove();
        $('#title').text('Re-create the line length.');
        $('.instructions').text('');

        // Set the response variable to default and increment guess counter.
        acceptType = 0;
        guessCounter = guessCounter + 1;
        response_counter = response_counter + 1;

        // Prep signal that we're not ready.
        response = -99;
        ready_signal = -1;
        reset_signal = 'Changed';
        sendReadySignal(ready_signal);

        // Track the mouse during response.
        response = undefined;
        response_bar_size = undefined;
        $(document).mousemove(trackMouseMovement);

        // If they click to submit a response, clear the timeout and update the site text.
        change_lock = false;
        $(document).click(acknowledgeChangedGuess);

        // Get partner's guess.
        setTimeout( function() {

            // Send data and ready signal.
            sendReadySignal(ready_signal);
            sendDataToServer();

            // Show and hide objects as needed.
            partner_bar.hide();
            partner_background.hide();
            partner_label.hide();
            own_label.hide();
            response_bar.hide();
            response_background.hide();
            getPartnerGuess();

          }, response_timeout*1000);
    }, 1);
};

//
// Acknowledge that they've submitted a new guess.
//
function acknowledgeChangedGuess () {

    // Only allow them to guess in certain settings.
    if (change_lock === false){

        // Register response and hide bars.
        response = Math.round(response_bar_size/PPU);
        ready_signal = 1;
        console.log('Mouse click: ' + response);

        // Reset for next trial.
        Mousetrap.resume();
        $(document).off('mousemove',trackMouseMovement);

        // Update text.
        $('#title').text('Your updated response has been recorded.');
        $('.instructions').text("Please wait for your partner's guess.");

        // Only allow them to acknowledge once.
        change_lock = true;
    }
};

//
// Wait for partner acceptance.
//
function waitToAccept () {
    setTimeout(checkIfPartnerAccepted, 1000);
};

//
// Grab partner's most recent data entry.
//
function fetchPartnerData () {

    reqwest({
        url: '/node/' + partner_node_id + '/infos',
        method: 'get',
        type: 'json',
        success: function (resp) {

            // If the partner does have something to fetch...
            if (resp.infos.length > 0) {

                // Grab the IDs for all items.
                entire_guess_history = $.map(resp.infos, function(el) { return el.id; });

                // Grab only the most recent guess.
                most_recent_guess = Math.max.apply(Math,entire_guess_history);
                most_recent_line = $.grep(resp.infos, function(v) {
                    return v.id==most_recent_guess;
                })[0];

                // Strip out only the contents of that most recent guess.
                partner_guess_record = JSON.parse(most_recent_line.contents);

            } else {

                // If we don't have anything yet, return NaN.
                partner_guess_record = NaN;

            }
        },
        error: function (err) {
            console.log("Error when fetching partner's data: " + err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
  });
};

//
// Montior the server to see if their partner's accepted a guess.
//
function checkIfPartnerAccepted () {

    // Get partner's data and increment finalization counter.
    tried_to_finalize = tried_to_finalize + 1;
    fetchPartnerData();

    // Loop back if this is the first trial and the partner hasn't guessed.
    if (partner_guess_record == NaN) {
        waitToAccept();
    } else {

        // Grab partner's guess data.
        partner_guess_trial = partner_guess_record['trialNumber'];
        partner_accept_type = partner_guess_record['acceptType'];
        // console.log("Partner's last guess logged in trial " + partner_guess_trial);

        // If the partner hasn't guessed on this trial:
        if (partner_guess_trial < trialIndex) {

            // Try to finalize if we've been hanging, ...
            if (tried_to_finalize > finalize_cutoff/3){
                tryToFinalize();

            // but just keep checking if we haven't been hanging.
            } else {
                waitToAccept();
            }

        // If the partner has already indicated that they're done, move on.
        } else if (partner_guess_trial > trialIndex) {
            proceedToNextTrial();

        // If the partner has guessed and is still on this trial, see whether they've accepted before moving on.
        } else {

            // If we've both accepted, move into the final checking phase.
            if ((partner_accept_type == 1 && acceptType == 1) || (tried_to_finalize > finalize_cutoff/3)){

                // Update text.
                console.log('Attempting to finalize guess...');
                $('#title').text('Processing your guess...');
                $('.instructions').text('');
                setTimeout(tryToFinalize,
                           partner_change_announcement * 1000);

            // If we haven't both accepted yet...
            } else {
                partner_response_counter = partner_guess_record['responseCounter'];

                // If they haven't submitted a guess, wait again.
                if (partner_response_counter < 0) {
                    waitToAccept();

                // If they're not on the same response counter that we are, wait more.
                } else if (partner_response_counter !== response_counter) {
                    waitToAccept();

                  // If their last signal was a reset signal, wait.
                } else if (response_signal === 0){
                    waitToAccept();

                // Otherwise, get their guess and send the appropriate ready signal.
                } else {
                    sendReadySignal(-1);
                    getPartnerGuess();
                }
            }
        }
    }
};

//
// Figure out if we're ready to move on to the next trial.
//
function tryToFinalize () {

    // Check if we've been hanging on finalization.
    tried_to_finalize = tried_to_finalize + 1;
    if (tried_to_finalize > finalize_cutoff){
        current_ready_signals = 2;
        hanging_signal = 'Hanging';
        socket.send(channel + ':' + JSON.stringify(hanging_signal));
    }

    // If both of us have accepted, move on.
    fetchPartnerData();
    partner_accept_type = partner_guess_record['acceptType'];
    partner_guess_trial = partner_guess_record['trialIndex'];
    partner_response_counter = partner_guess_record['responseCounter'];
    partner_final_accuracy = partner_guess_record['finalAccuracy'];

    // Send data to server if their partner is on the same response counter, finished the last trial, or
    if (partner_accept_type==1 && acceptType == 1){
        if (partner_response_counter == response_counter) {
            console.log('Successfully finalized: Partner on same response counter.');
            calculateFinalAccuracy();
            sendDataToServer();
            proceedToNextTrial();
        } else if (partner_guess_trial == testN && partner_final_accuracy !== 0) {
            console.log('Successfully finalized: Partner finished all test trials.');
            calculateFinalAccuracy();
            sendDataToServer();
            proceedToNextTrial();
        } else if (partner_final_accuracy !== 0){
            console.log('Successfully finalized: Partner advanced to next trial.');
            calculateFinalAccuracy();
            sendDataToServer();
            proceedToNextTrial();
        } else {
            console.log('Failed to finalize.');
            console.log('partner_accept_type = '+ partner_accept_type + ',\nacceptType = ' + acceptType + ',\npartner_response_counter = ' + partner_response_counter + ',\nresponse_counter = '+ response_counter);
            getPartnerGuess();
        }
    // If not, just keep checking.
    } else {
        console.log('Failed to finalize.');
        console.log('partner_accept_type = '+ partner_accept_type + ',\nacceptType = ' + acceptType + ',\npartner_response_counter = ' + partner_response_counter + ',\nresponse_counter = '+ response_counter);
        getPartnerGuess();
    }
};

//
// Calculate final accuracy.
//
function calculateFinalAccuracy () {
    if (response == -99){
      final_accuracy = response;
    } else {
      final_accuracy = (100 - Math.abs(int_list[trialIndex] - response))/100;
    }
};

//
// Monitor for unresponsive participants.
//
function monitorForAbandoned () {

    // Turn off click ability and event listeners.
    $(document).off('click');
    $(document).off('mousemove',trackMouseMovement);

    // Remove partners' guesses and buttons.
    partner_background.hide();
    partner_bar.hide();
    partner_label.hide();
    response_background.hide();
    response_bar.hide();
    own_label.hide();
    $('#acceptGuess').remove();
    $('#changeGuess').remove();

    // Log response as being abandoned.
    abandonment_signal = -99;
    final_accuracy = -9999999999999999999999999999;
    socket.send(channel + ':' + JSON.stringify(abandonment_signal));
};

//
$(document).keydown(function(e) {
    var code = e.keyCode || e.which;
    if (code == 13) {
        if (enter_lock === false) {
            enter_lock = true;

            drawUserInterface();

            // If we're at the first trial, proceed directly to stimulus presentation.
            if (trialIndex === 0) {

                response_background.hide();
                response_bar.hide();
                proceedToNextTrial();

            // If this isn't our first trial, continue as normal.
            } else {
                proceedToNextTrial();
            }
        }
    }
});
