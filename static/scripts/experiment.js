// Settings
PPU = 5; // Pixels per base unit.
xMax = 100; // Maximum size of a bar in base units.
trialIndex = -1;
stimulusYSize = 0;
enter_lock = true;
partner_accept_type = 0;
waiting_for_partner = 0;
partner_guess_record = NaN;
chosen_stimulus = NaN;
chosen_stimulus_number = NaN;
display_stimulus_number = NaN;
stimulus_competitors = 3;
stimulus_info = NaN;
stimulus0_list = NaN;
stimulus1_list = NaN;
stimulus2_list = NaN;
chosen_stimulus_list = NaN;

// Set a series of timeouts (in seconds).
stimulus_timeout = 1; // Time for which a stimulus is displayed.
wait_time = 2; // Time between stimulus viewing and response.
correction_timeout = 2; // Time for which the correction is displayed.
response_timeout = 2; // Time for which a response is allowed.
partner_timeout = 3; // Time for which partner's guess is displayed.
partner_change_announcement = 2; // Time for which the partner's change announcement is displayed.
inter_trial_time = 5; // Time to wait between trials.
abandonment_timer = 60; // Time to wait before kicking someone out.
abandonment_announcement = 5; // Time to wait before moving forward after being abandoned.
finalize_cutoff = 3; // Number of times to check for finalization.
waiting_for_partner_timeout = 5 * 60; // Time to wait before showing opt-out button.

// Set training information.
trainN = 1;//10; // Define number of training trials.
testN = 1;//15; // Define number of test trails (over training trials).
totalN = trainN + testN + 1; // Summing training and test trials (plus one for experiment mechanics).
trial_correct_error = 4; // Acceptable difference for correct answer in training.

// Specify location information for stimuli.
inset = 1;
stimulus_bg_width = 500;
stimulus_bg_height = 25;
stimulus_x_start = 50;
stimulus_label_start = stimulus_x_start - 30;
stimulus0_y_start = 150;
stimulus1_y_start = stimulus0_y_start + stimulus_bg_height + 50;
stimulus2_y_start = stimulus1_y_start + stimulus_bg_height + 50;

// Specify location information for responses.
response_x_start = 100;
response_y_start = stimulus2_y_start + stimulus_bg_height + 50;
response_bg_width = 500;
response_bg_height = 25;

// Specify location information for partner's guess (test only) and correction (training only).
partner_y_start = response_y_start + 100;
partner_x_start = response_x_start;
correction_y_start = response_y_start - 100;
correction_x_start = response_x_start;

// Specify location information for buttons.
change_guess_y = partner_y_start + 200;
change_guess_x = response_x_start;
accept_guess_y = partner_y_start + 200;
accept_guess_x = response_x_start * 3;

// Specify colors for own, partner, and stimulus boxes.
partner_guess_color = "#0b6b13";
own_guess_color = "#0B486B";
stimulus_color = "#b32113";
correction_color = "#8e8e8e";

// Create the agent.
create_agent = function() {
    reqwest({
        url: "/node/" + dallinger.identity.participantId,
        method: 'post',
        type: 'json',
        success: function (resp) {
            my_node_id = resp.node.id;
            check_for_partner();
        },
        error: function (err) {
            console.log("Error when initializing participant: "+ err);
            $("#title").text("An error has occurred -- creating participant.");
            $(".instructions").text("Please close this window and return this HIT.");
            err_response = JSON.parse(err.response);
            if (err_response.hasOwnProperty('html')) {
                $('body').html(err_response.html);
                dallinger.allowExit();
                dallinger.goToPage('debriefing');
            }
        }
    });
};

//
// Monitor for the participant to be joined with a partner.
//
check_for_partner = function() {
    reqwest({
        url: "/node/" + my_node_id + "/vectors",
        method: 'get',
        type: 'json',
        success: function (resp) {
            // Ask for all my vectors.
            vectors = resp.vectors;
            if (vectors.length > 0) {
                // if there are vectors, go through their origin_ids
                // whichever origin id is not the same as your node_id,
                // that must be your partner's id.
                partner_node_id = -1;
                for (i = 0; i < vectors.length; i++) {
                    if ((vectors[i].origin_id != my_node_id) && vectors[i].origin_id != 1) {
                        partner_node_id = vectors[i].origin_id;
                    }
                }
                console.log('Partner node ID: ' + partner_node_id);
                // Now that you've identified your partner, move on.
                get_received_info();
            } else {
                // If there are no vectors, wait 1 second and then ask again
                setTimeout(function(){
                    waiting_for_partner = waiting_for_partner + 1;
                    check_for_partner();
                }, 1000);

                // If they've been waiting a long time for a partner, give them an option to leave.
                if (waiting_for_partner == waiting_for_partner_timeout){
                    mercy_button = "<button type='button' class='btn btn-secondary btn-lg' id='mercyButton' style='float: left;'>Opt out (or broken)</button>";
                    $("body").append(mercy_button);
                    $("#mercyButton").click(function(){
                      dallinger.allowExit();
                      dallinger.goToPage('debriefing');
                    });
                }
            }
        },
        error: function (err) {
            console.log("Error when attempting to identify partner: "+ err);
            $("#title").text("An error has occurred -- identifying partner.");
            $(".instructions").text("Please close this window and return this HIT.");
        }
    });
};

//
// Connect them to their partner.
//
get_received_info = function() {
    reqwest({
        url: "/node/" + my_node_id + "/received_infos",
        method: 'get',
        type: 'json',
        success: function (resp) {
            r = resp.infos[0].contents;
            stimulus_info = JSON.parse(r);
            stimulus0_list = stimulus_info[0][0];
            stimulus1_list = stimulus_info[0][1];
            stimulus2_list = stimulus_info[0][2];
            chosen_stimulus_list = stimulus_info[1];
            $("#title").text("Partner found and connected");
            $(".instructions").text("Press enter to begin");
            enter_lock = false;

            // Remove the button, if it's there.
            if (waiting_for_partner > waiting_for_partner_timeout){
                waiting_for_partner = 0;
                $("#mercyButton").remove();
            }
        },
        error: function (err) {
            console.log("Error when checking if partner is connected: "+err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
    });
};


//
// Draw the user interface.
//
drawUserInterface = function () {

    paper = Raphael(0, 50, 800, 600);

    // Draw stimulus0
    // Create the stimulus0 background.
    stimulus0_background = paper.rect(stimulus_x_start,
                                     stimulus0_y_start,
                                     stimulus_bg_width,
                                     stimulus_bg_height-2*inset);
    stimulus0_background.attr("stroke", "#CCCCCC");
    stimulus0_background.attr("stroke-dasharray", "--");
    stimulus0_background.hide();

    // Draw the stimulus0 bar with the next line length in the list.
    stimulus0_bar = paper.rect(stimulus_x_start,
                              stimulus0_y_start-inset,
                              0,
                              25);
    stimulus0_bar.attr("fill", stimulus_color);
    stimulus0_bar.attr("stroke", "none");

    // Draw the stimulus0 label.
    stimulus0_label = paper.text(stimulus_label_start,
                                  stimulus0_y_start+10,
                                  "#1");
    stimulus0_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                           'font-size': '14px',
                           'font-weight': 'bold',
                           'text-anchor': 'start'});
    stimulus0_label.hide();

    // Draw stimulus1
    // Create the stimulus1 background.
    stimulus1_background = paper.rect(stimulus_x_start,
                                     stimulus1_y_start,
                                     stimulus_bg_width,
                                     stimulus_bg_height-2*inset);
    stimulus1_background.attr("stroke", "#CCCCCC");
    stimulus1_background.attr("stroke-dasharray", "--");
    stimulus1_background.hide();

    // Draw the stimulus1 bar with the next line length in the list.
    stimulus1_bar = paper.rect(stimulus_x_start,
                              stimulus1_y_start-inset,
                              0,
                              25);
    stimulus1_bar.attr("fill", stimulus_color);
    stimulus1_bar.attr("stroke", "none");

    // Draw the stimulus1 label.
    stimulus1_label = paper.text(stimulus_label_start,
                                  stimulus1_y_start+10,
                                  "#2");
    stimulus1_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                           'font-size': '14px',
                           'font-weight': 'bold',
                           'text-anchor': 'start'});
    stimulus1_label.hide();

    // Draw stimulus2
    // Create the stimulus2 background.
    stimulus2_background = paper.rect(stimulus_x_start,
                                     stimulus2_y_start,
                                     stimulus_bg_width,
                                     stimulus_bg_height-2*inset);
    stimulus2_background.attr("stroke", "#CCCCCC");
    stimulus2_background.attr("stroke-dasharray", "--");
    stimulus2_background.hide();

    // Draw the stimulus2 bar with the next line length in the list.
    stimulus2_bar = paper.rect(stimulus_x_start,
                              stimulus2_y_start-inset,
                              0,
                              25);
    stimulus2_bar.attr("fill", stimulus_color);
    stimulus2_bar.attr("stroke", "none");

    // Draw the stimulus2 label.
    stimulus2_label = paper.text(stimulus_label_start,
                                  stimulus2_y_start+10,
                                  "#3");
    stimulus2_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                           'font-size': '14px',
                           'font-weight': 'bold',
                           'text-anchor': 'start'});
    stimulus2_label.hide();
};

//
// Move to next trial: Increment trial number, display stimulus, and allow response.
//
proceedToNextTrial = function () {

    // Increment the trial and guess counter.
    trialIndex = trialIndex + 1;
    guessCounter = -1;
    response_counter = -1;
    partner_response_counter = 0;
    acceptType = 0;
    partner_accept_type = 0;
    wait_for_partner_guess = 0;
    final_accuracy = 0;

    // Identify whether we're in training or testing.
    if (trialIndex < trainN){
        trialType = "train";
    } else {
        trialType = "test";
    }

    // Move to next trial if we haven't hit our target n.
    if ((trialIndex+1) < totalN) {

      // Update announcements and current trial info.
      $("#title").text("Beginning next round");
      $(".instructions").text("");
      console.log('BEGINNING TRIAL '+trialIndex);

      setTimeout( function() {

          // Prevent repeat keypresses.
          Mousetrap.pause();

          // Reveal stimulus for set amount of time.
          showStimuliBars();

          // Identify which will be the to-be-recalled stimulus.
          chosen_stimulus_number = chosen_stimulus_list[trialIndex];
          display_stimulus_number = chosen_stimulus_number+1;
          chosen_stimulus = stimulus_info[0][chosen_stimulus_number][trialIndex];

          // Allow response only for a limited amount of time.
          var unresponsiveParticipant;
          setTimeout(hideStimuliBars,
                     stimulus_timeout*1000);
          setTimeout(allowResponse,
                     (stimulus_timeout+wait_time)*1000);

      }, inter_trial_time * 1000);

      // If this is a training trial...
      if (trialType == 'train') {

          // Update header for participant.
          $("#training-or-testing").html("Training");
          $("#total-trials").html(trainN);
          $("#trial-number").html(trialIndex+1);

      // ... or if this is a test trial ...
      } else {

          // Update header for participant.
          $("#training-or-testing").html("Testing");
          $("#total-trials").html(testN);
          $("#trial-number").html(trialIndex+1-trainN);

      }

    // ... or if we're done, finish up.
    } else {

        // Send data back to the server and proceed to questionnaire.
        paper.remove();
        dallinger.allowExit();
        dallinger.goToPage('questionnaire');

    }
};

//
// For training trials, show the correct length.
//
showCorrectLength = function() {

    // Draw correction background.
    correction_background = paper.rect(correction_x_start,
                                       correction_y_start,
                                       response_bg_width,
                                       response_bg_height - 2 * inset);
    correction_background.attr("stroke", "#CCCCCC");
    correction_background.attr("stroke-dasharray", "--");

    // Draw correction bar.
    correction_bar = paper.rect(correction_x_start,
                                correction_y_start - inset,
                                response_bg_width,
                                response_bg_height);
    correction_bar.attr("fill", correction_color);
    correction_bar.attr("stroke", "none");
    correction_bar.attr({x: correction_x_start,
                       width: chosen_stimulus*PPU});

    // Show labels.
    correction_label = paper.text(correction_x_start + 10,
                                  correction_y_start - inset + 50,
                                  "Correct length");
    correction_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                           'font-size': '14px',
                           'text-anchor': 'start'});
    own_label = paper.text(response_x_start + 10,
                           response_y_start - inset + 50,
                           "Your guess");
    own_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
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
    if (Math.abs(response - chosen_stimulus) < trial_correct_error) {
        $("#title").text("Your guess was correct!");
        $(".instructions").text("The blue bar is your guess; the grey bar is the correct answer.");
    } else if (response == -99){
        $("#title").text("You didn't respond in time");
        $(".instructions").html("Make sure to respond within "+response_timeout+" seconds.<br>The grey bar is the correct answer.");
    } else {
        $("#title").text("Your guess was incorrect");
        $(".instructions").text("The blue bar is your guess; the grey bar is the correct answer.");
    }
};

//
// Send the data back to the server.
//
sendDataToServer = function(){

    trialData = JSON.stringify({"trialType": trialType,
                                "trialNumber": trialIndex,
                                "guessCounter": guessCounter,
                                "responseCounter": response_counter,
                                "simulus1Length": stimulus0_width,
                                "simulus2Length": stimulus1_width,
                                "simulus3Length": stimulus2_width,
                                "chosenStimulus": chosen_stimulus,
                                "guess": response,
                                "acceptType": acceptType,
                                "finalAccuracy": final_accuracy});

    // Prepare data to send to server.
    console.log('Accept Type: '+acceptType);
    reqwest({
        url: "/info/" + my_node_id,
        method: 'post',
        data: {
            contents: trialData,
            info_type: "Info",
            property3: final_accuracy
        }, success: function(resp) {
            if (trialIndex + 1 == totalN) {
                create_agent();
            }
        }
    });
};

showStimuliBars = function () {
    $("#title").text("Remember these line lengths.");
    $(".instructions").text("");
    stimulus0_width = stimulus0_list[trialIndex];
    stimulus0_background.show();
    stimulus0_label.show();
    stimulus0_bar.show().attr({ width: stimulus0_width*PPU });
    stimulus1_width = stimulus1_list[trialIndex];
    stimulus1_background.show();
    stimulus1_label.show();
    stimulus1_bar.show().attr({ width: stimulus1_width*PPU });
    stimulus2_width = stimulus2_list[trialIndex];
    stimulus2_background.show();
    stimulus2_label.show();
    stimulus2_bar.show().attr({ width: stimulus2_width*PPU });
};

hideStimuliBars = function() {
    // Hide stimulus bar and text.
    $("#title").text("");
    $(".instructions").text("");
    stimulus0_bar.hide();
    stimulus0_background.hide();
    stimulus0_label.hide();
    stimulus1_bar.hide();
    stimulus1_background.hide();
    stimulus1_label.hide();
    stimulus2_bar.hide();
    stimulus2_background.hide();
    stimulus2_label.hide();
};

//
// Allow user response only for a set number of seconds.
//
allowResponse = function() {

    // Create response background.
    response_background = paper.rect(response_x_start,
                                     response_y_start,
                                     response_bg_width,
                                     response_bg_height-2*inset);
    response_background.attr("stroke", "#CCCCCC");
    response_background.attr("stroke-dasharray", "--");
    response_background.show();

    // Draw response bar.
    response_bar = paper.rect(response_x_start,
                              response_y_start-inset,
                              response_bg_width,
                              response_bg_height);
    response_bar.attr("fill", own_guess_color);
    response_bar.attr("stroke", "none");

    // Display response bar and reset instructions.
    $("#title").html("Re-create the line length for\n<b><u>line #"+display_stimulus_number+"</b></u>.");
    $(".instructions").text("");
    response_bar.show().attr({width: 0});

    // Set the response variable to default and increment guess counter.
    acceptType = 0;
    guessCounter = guessCounter + 1;
    response_counter = response_counter + 1;

    // Track the mouse during response.
    Mousetrap.pause();
    $(document).mousemove(trackMouseMovement);

    // Monitor for an unresponsive participant.
    unresponsiveParticipant = setTimeout(function(){
                                saveDummyGuess();
                                if (trialType != 'train'){
                                    $("#title").text("You didn't respond in time");
                                    $(".instructions").text("Please wait for your partner's guess.");
                                };
                              }, response_timeout*1000);

    // If they click to submit a response, clear the timeout and update the site text.
    $(document).click(saveGuess);
};

//
// Acknowledge participant guess.
//
function saveGuess() {
    clearTimeout(unresponsiveParticipant);
    response = Math.round(response_bar_size/PPU);
    acknowledgeGuess();
}

function saveDummyGuess() {
    response = -99;
    acknowledgeGuess();
}

function acknowledgeGuess(){

    // Stop the unresponsive timer and prevent multiple guesses.
    $(document).off("mousemove",trackMouseMovement);
    $(document).off('click');

    // Register response and hide bars.
    sendDataToServer();

    // console.log('Mouse click: '+response);
    response_bar.hide();
    response_background.hide();

    // Stop the timer if we click.
    $(document).click(function(e) { e.stopPropagation(); });

    // Reset for next trial.
    Mousetrap.resume();

    // If a training trial, display correction; if test, update text.
    if (trialType == 'train') {

        // Display correct length.
        showCorrectLength();

        setTimeout( function() {
            // hide correct length
            response_bar.hide();
            response_background.hide();
            own_label.hide();
            correction_bar.hide();
            correction_background.hide();
            correction_label.hide();

            if (trialIndex == (trainN-1)) {
                // if its the last trainging trial
                $("#title").text("Congrats! You've finished the training trials");
                $(".instructions").html("Your next trial will be a <b>test</b> trial.");
                setTimeout(function(){
                    $("#title").text("");
                    $(".instructions").html("");
                    checkPartnerTraining();
                }, 5000 + (correction_timeout*1000));
            } else {
                // if there's more training ot do
                proceedToNextTrial();
            }
        }, correction_timeout*1000);
    } else {
        // Wait for partner to guess.
        $("#title").text("Your response has been recorded.");
        $(".instructions").text("Please wait for your partner's guess.");
        setTimeout(getPartnerGuess, 1000);
    }
}

//
// Track mouse movement during response.
//
trackMouseMovement = function(e) {
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
waitForTraining = function(){
    // Keep track of how long we've been waiting.
    waiting_for_partner = waiting_for_partner + 1;

    // Update text and check again.
    $("#title").text("Please wait");
    $(".instructions").text("Your partner is finishing training");
    setTimeout(checkPartnerTraining,1000);
};

//
// Wrap up if partner abandons.
//
handleAbandonedPartner = function(){
    // Inform player about what happened.
    $("#title").text("Your partner has abandoned the experiment.");
    $(".instructions").text("You will receive base pay and any earned bonuses.");

    // Move on.
    setTimeout( function () {
        dallinger.allowExit();
        dallinger.goToPage('debriefing');
    }, abandonment_announcement*1000);
};

//
// Check whether our vectors have failed (i.e., partner abandoned/returned HIT).
//
checkFailedVectors = function() {
  reqwest({
      url: "/node/" + my_node_id + "/vectors",
      method: 'get',
      type: 'json',
      success: function (resp) {
          vectors = resp.vectors;
          if (vectors.length == 1) { handleAbandonedPartner(); }
      },
      error: function (err) {
          console.log("Error when attempting to check for failed node: "+ err);
          $("#title").text("An error has occurred -- checking for failed partner.");
          $(".instructions").text("Please close this window and return this HIT.");
      }
  });
};

//
// Montior the server to see if their partner's finished training.
//
checkPartnerTraining = function() {

    reqwest({
        url: "/node/" + partner_node_id + "/infos",
        method: 'get',
        type: 'json',
        success: function (resp) {

            // Make sure our partner is still connected.
            checkFailedVectors();

            if (waiting_for_partner > waiting_for_partner_timeout) {
                // If we've been waiting forever, kick us to debrief.
                handleAbandonedPartner();
            } else if (resp.infos.length < trainN) {
                // if the partner is still in training loop back around
                waitForTraining();
            } else {
                $("#title").text("");
                $(".instructions").text("");
                proceedToNextTrial();
            }
        },
        error: function (err) {
            console.log("Error when trying to see if partner finished training: "+err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
    });
};

//
// Check to see if partner has guessed one time per second.
//
waitForGuess = function() {

    // Increment wait timer.
    wait_for_partner_guess = wait_for_partner_guess + 1;

    // Then try again.
    setTimeout(getPartnerGuess, 1000);
};

//
// Monitor the server to see if partner has guessed.
//
getPartnerGuess = function() {
    $("#title").text("Your response has been recorded.");
    $(".instructions").text("Please wait for your partner's guess.");

    if (wait_for_partner_guess > 20) {
        handleAbandonedPartner();
    }

    // Get partner's data.
    fetchPartnerData();

    // If partner hasn't responded, wait.
    if (partner_guess_record == NaN) {
        waitForGuess();
    } else {

        // Extract guess information from data.
        partner_guess_trial = partner_guess_record["trialNumber"];
        partner_response_counter = partner_guess_record['responseCounter'];
        partner_accept_type = partner_guess_record['acceptType'];
        console.log("Partner's current trial: "+partner_guess_trial);

        // if you are not on the same trial and response counter wait for your partner
        if (partner_guess_trial != trialIndex || partner_response_counter != response_counter) {
            waitForGuess();
        } else {
            // if at least one of you has not accepted then show responses again
            if (partner_accept_type != 1 || acceptType != 1) {
                enter_lock = false;
                partner_x_guess = partner_guess_record["guess"];
                wait_for_partner_guess = 0;
                showPartner();
            } else {
                final_accuracy = Math.abs(response - chosen_stimulus)
                sendDataToServer();
                proceedToNextTrial();
            }
        }
    }
};

//
// Display partner's guess.
//
showPartner = function() {
    // Show both guesses.
    showOwnGuess();
    showPartnerGuess();

    // Initialize change button.
    change_guess_button = "<input type='button' class='btn btn-secondary btn-lg' id='changeGuess' value='Change my guess' style='position:absolute;top:"+change_guess_y+"px;left:"+change_guess_x+"px;'>";
    $("body").append(change_guess_button);
    $(document).unbind('click');
    $(document).off('click');

    // If they change their guess, stop the abandonment timer and allow to change.
    $("#changeGuess").click(function(){
        $(document).click(function(e) { e.stopPropagation(); });
        // clearTimeout(abandoned_participant);
        changeOwnGuess();
    });

    // If nobody guesses, ask them to go back and guess.
    if (partner_x_guess < 0 && response < 0) {
        $("#title").html("Neither you nor your partner submitted a guess.<br><br>(Remember: You were asked to recreate line #"+display_stimulus_number+".)");
        $(".instructions").text("Please submit your guess by clicking 'Change my guess'.");
    // If they guessed, allow them to accept it.
    } else {
        // If someone submitted a guess, allow them to accept.
        accept_guess_button = '<input type="button" class="btn btn-secondary btn-lg" id="acceptGuess" value="I\'m done" style="position:absolute;top:'+accept_guess_y+'px;left:'+accept_guess_x+'px;">';

        // Show updated instructions based on whether they or their partner changed their guess.
        if (response_counter===0){
            $("#title").html("You were asked to recreate line #"+display_stimulus_number+".<br>Would you like to accept your guess or change it?");
        } else { // We've already identified partner_accept_type in the enclosing function.
            if (partner_accept_type===0 && acceptType===1){
                $("#title").html("Your partner chose to change their guess.<br>Would you like to accept your guess or change it?<br><br>(Remember: You were asked to recreate line #"+display_stimulus_number+".)");
            } else if (partner_accept_type===1 && acceptType===0){
                $("#title").html("Your partner did not choose to change their guess.<br>Would you like to accept your guess or change it?<br><br>(Remember: You were asked to recreate line #"+display_stimulus_number+".)");
            } else if (partner_accept_type===0 && acceptType===0){
                $("#title").html("Your partner also chose to change their guess.<br>Would you like to accept your guess or change it?<br><br>(Remember: You were asked to recreate line #"+display_stimulus_number+".)");
            }
        }
        $(".instructions").text("Your guess is shown in blue, and your partner's guess is shown in green.");

        // If they submitted a guess, allow them to accept it and stop the abandonment timer.
        $("body").append(accept_guess_button);
        $("#acceptGuess").click(function() {
            $(document).click(function(e) { e.stopPropagation(); });
            acceptOwnGuess();
        });
    }
};

//
// Draw partner's guess.
//
showPartnerGuess = function(){

  // Draw partner's background.
  paper = Raphael(0, 50, 800, 600);
  partner_background = paper.rect(partner_x_start,
                                  partner_y_start,
                                  response_bg_width,
                                  response_bg_height - 2 * inset);
  partner_background.attr("stroke", "#CCCCCC");
  partner_background.attr("stroke-dasharray", "--");

  // Draw partner's guess.
  partner_bar = paper.rect(partner_x_start,
                           partner_y_start - inset,
                           response_bg_width,
                           response_bg_height);
  partner_bar.attr("fill", partner_guess_color);
  partner_bar.attr("stroke", "none");
  if (partner_x_guess > 0){
      partner_bar.show().attr({x: partner_x_start,
                        width: partner_x_guess*PPU
                        });
  } else {
    partner_bar.show().attr({x: partner_x_start,
                      width: 0
                      });
  }

  // Label the bar.
  partner_label = paper.text(partner_x_start + 10,
                             partner_y_start - inset + 50,
                             "Your partner's guess");
  partner_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                      'font-size': '14px',
                      'text-anchor': 'start'});
};

//
// Show own guess.
//
showOwnGuess = function(){

    // Turn off mousetracking.
    $(document).off('mousemove',trackMouseMovement);

    // Fill in the response bar if they responded.
    response_background.show();
    if (response > 0) {
    response_bar.show().attr({x: response_x_start,
                              width: response*PPU
                             });
    } else {
    response_bar.show().attr({x: response_x_start,
                              width: 0
                             });
    }

    // Label the bar.
    own_label = paper.text(response_x_start + 10,
                         response_y_start - inset + 50,
                         "Your guess");
    own_label.attr({'font-family':  "Helvetica Neue,Helvetica,Arial,sans-serif",
                    'font-size': '14px',
                    'text-anchor': 'start'});
};

//
// Accept own guess.
//
acceptOwnGuess = function(){

    // Remove partners' guesses and buttons.
    partner_background.hide();
    partner_bar.hide();
    partner_label.hide();
    response_background.hide();
    response_bar.hide();
    own_label.hide();
    $("#acceptGuess").remove();
    $("#changeGuess").remove();

    // Reset text.
    $("#title").text("Please wait...");
    $(".instructions").text("Checking to see if your partner has responded.");

    // Note whose guess we accepted and send data.
    acceptType = 1;
    response_counter = response_counter + 1;
    sendDataToServer();

    // Start next trial.
    getPartnerGuess();
};

//
// Change guess.
//
changeOwnGuess = function(){

    // Add a brief timeout between pressing button and allowing the change.
    setTimeout( function() {

        // Remove buttons and update text.
        $("#acceptGuess").remove();
        $("#changeGuess").remove();
        $("#title").text("Re-create the line length.");
        $(".instructions").text("");

        // Set the response variable to default and increment guess counter.
        acceptType = 0;
        guessCounter = guessCounter + 1;
        response_counter = response_counter + 1;
        response = -99;

        // // Track the mouse during response.
        $(document).mousemove(trackMouseMovement);

        // If they click to submit a response, clear the timeout and update the site text.
        change_lock = false;
        $(document).click(acknowledgeChangedGuess);

        // Get partner's guess.
        setTimeout( function() {
            $(document).click(function(e) { e.stopPropagation(); });

            // Send data
            sendDataToServer();

            // Show and hide objects as needed.
            if (response === -99){
                $("#title").text("You didn't respond in time");
                $(".instructions").html("Please wait for your partner's guess.");
            }
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
acknowledgeChangedGuess = function() {

    // Only allow them to guess in certain settings.
    if (change_lock === false){

        // Register response and hide bars.
        response = Math.round(response_bar_size/PPU);
        // console.log('Mouse click: '+response);

        // Reset for next trial.
        Mousetrap.resume();
        $(document).off("mousemove",trackMouseMovement);

        // Update text.
        $("#title").text("Your updated response has been recorded.");
        $(".instructions").text("Please wait for your partner's guess.");

        // Only allow them to acknowledge once.
        change_lock = true;
    }
};

//
// Grab partner's most recent data entry.
//
fetchPartnerData = function(){

    reqwest({
        url: "/node/" + partner_node_id + "/infos",
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
            console.log("Error when fetching partner's data: "+err);
            err_response = JSON.parse(err.response);
            $('body').html(err_response.html);
        }
    });
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
