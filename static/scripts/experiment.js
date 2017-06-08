// Settings
PPU = 5;      // Pixels per base unit.
xMax = 100;   // Maximum size of a bar in base units.
trialIndex = 0;
stimulusYSize = 0;
enter_lock = true;
click_lock = true;
stimulus_timeout = 1; // Time in seconds for stimulus timeout.
response_timeout = 2; // Time in seconds for response timeout.
trainN = 20; // Define number of training trials.
testN = trainN + 50; // Define number of test trails (over training trials).

// Create the agent.
create_agent = function() {
    reqwest({
        url: "/node/" + participant_id,
        method: 'post',
        type: 'json',
        success: function (resp) {
            my_node_id = resp.node.id;
            get_info();
        },
        error: function (err) {
            console.log(err);
            err_response = JSON.parse(err.response);
            if (err_response.hasOwnProperty('html')) {
                $('body').html(err_response.html);
            } else {
                allow_exit();
                go_to_page('postquestionnaire');
            }
        }
    });
};

get_info = function() {
    setTimeout(get_received_info, 1000);
};

get_received_info = function() {
    reqwest({
        url: "/node/" + my_node_id + "/received_infos",
        method: 'get',
        type: 'json',
        success: function (resp) {
            if (resp.infos.length === 0) {
                get_info();
            } else {
                r = resp.infos[0].contents;
                int_list = JSON.parse(r);
                $("#title").text("Partner connected");
                $(".instructions").text("Press enter to begin");
                enter_lock = false;
            }

            // // Get training values
            // xTrain = data.x;
            // yTrain = data.y;

            // N = xTrain.length * 2;
            // $("#total-trials").html(N);
            // yTrainReported = [];

            // // Get test values.
            // // half are from training; the rest are new
            // allX = range(1, xMax);
            // xTestFromTraining = randomSubset(xTrain, N/4);
            // xTestNew = randomSubset(allX.diff(xTrain), N/4);
            // xTest = shuffle(xTestFromTraining.concat(xTestNew));
            // yTest = [];
        },
        error: function (err) {
            console.log(err);
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

    inset = 1;

    // Draw the stimulus background.
    stimulus_background = paper.rect(50, 150, 500, 25-2*inset);
    stimulus_background.attr("stroke", "#CCCCCC");
    stimulus_background.attr("stroke-dasharray", "--");

    // Draw the stimulus bar with the next line length in the list.
    stimulus_bar = paper.rect(50, 150-inset, 0, 25);
    stimulus_bar.attr("fill", "#0B486B");
    stimulus_bar.attr("stroke", "none");

    // Draw the response background.
    response_x_start = 100;
    response_y_start = 350;
    response_bg_width = 500;
    response_bg_height = 25;

    // Create response background and bar.
    response_background = paper.rect(response_x_start, response_y_start, response_bg_width, response_bg_height-2*inset);
    response_background.attr("stroke", "#CCCCCC");
    response_background.attr("stroke-dasharray", "--");
    response_bar = paper.rect(response_x_start, response_y_start-inset, response_bg_width, response_bg_height);
    response_bar.attr("fill", "#0B486B");
    response_bar.attr("stroke", "none");

    // If we're at the first trial, proceed directly to stimulus presentation.
    if (trialIndex === 0) {

        response_background.hide();
        response_bar.hide();
        proceedToNextTrial();

    // If this isn't our first trial, continue as normal.
    } else {
        proceedToNextTrial();
    }

};

//
// Move to next trial: Increment trial number, display stimulus, and allow response.
//
proceedToNextTrial = function () {

    // // Prevent repeat keypresses.
    // Mousetrap.pause();

    // Increment the trial counter.
    trialIndex = trialIndex + 1;
    $("#trial-number").html(trialIndex);

    // Set up the stimuli.
    // if (trialIndex < N/2)
    //     stimulusXSize = xTrain[trialIndex - 1] * PPU;
    // else
    //     stimulusXSize = xTest[trialIndex - N/2 - 1] * PPU;
    stimulus_background.show();
    stimulus_bar.attr({ width: int_list[trialIndex - 1]*PPU });

    // Reveal stimulus for set amount of time.
    $("#title").text("Remember this line length.");
    $(".instructions").text("");
    stimulus_background.show();
    stimulus_bar.show();
    setTimeout(function(){

        // Hide stimulus bar.
        stimulus_bar.hide()
        stimulus_background.hide()

        // Display response bar.
        click_lock = false;
        $("#title").text("Re-create the line length.");
        response_background.show()
        response_bar.show();

        // Allow response.
        allowResponse();

    }, stimulus_timeout*1000);

    // If this is a training trial...
    if (trialIndex <= trainN) {

        // Display correction

        // Send data to server.
        sendDataToServer();
        clicked = false;

    // ... or if this is a test trial ...
    } else if (trialIndex > trainN && trialIndex <= testN) {

        // Display partner's guess

        // Send data to server.
        sendDataToServer();
        clicked = false;

    // ... or if we're done, finish up.
    } else {

        document.removeEventListener('click', mousedownEventListener);
        paper.remove();

        // Send data back to the server.
        sendDataToServer();
    };
};

//
// Send the data back to the server.
//
sendDataToServer = function(){

        // Identify whether we're in training or testing.
        if (trialIndex <= trainN){
            trialType = "train";
            trialNumber = trialIndex-1
        } else {
            trialType = "test";
            trialNumber = trialIndex-trainN-1
        };

        // Prepare data to send to server.
        trialData = JSON.stringify({"trialType": trialType, "trialNumber": trialNumber, "length": int_list[trialIndex - 1]*PPU, "guess": response});

        // If we're at the last trial, proceed to questionnaire.
        if (trialIndex === testN){
            reqwest({
                url: "/info/" + my_node_id,
                method: 'post',
                data: {
                    contents: trialData,
                    info_type: "Info"
                }, success: function(resp) {
                    create_agent();
                }
            });

        // Otherwise, keep going with the estimation setup.
        } else {
            reqwest({
                url: "/info/" + my_node_id,
                method: 'post',
                data: {
                    contents: trialData,
                    info_type: "Info"
                }
            });
        };
}

//
// Allow user response only for set number of seconds. Otherwise, proceed to next trial.
//
allowResponse = function() {

    // Enable response.
    document.addEventListener('click', mousedownEventListener);

    // Track the mouse during response.
    $(document).mousemove( function(e) {
        x = e.pageX-response_x_start;
        response_bar_size = bounds(x, 1*PPU, xMax*PPU);
        response_bar.attr({ x: response_x_start, width: response_bar_size });
    });

    // // If they take too long, disable response and move to next trial.
    // setTimeout( function() {

    //     $(document).off('click')
    //     $("#title").text("Reponse period timed out.");
    //     $(".instructions").text("Please wait for your partner's guess.");
    //     response_bar.hide();
    //     response_background.hide();
    //     click_lock = true;

    // }, response_timeout*1000);

}

//
// Listen for clicks and act accordingly.
//
function mousedownEventListener(event) {
    if (click_lock === false) {

        click_lock = true;

        // Allow user to create a response.
        response = Math.round(response_bar_size/PPU);
        response_bar.hide();
        response_background.hide();

        // Increment trial counter and release next stimulus.
        Mousetrap.resume();
        proceedToNextTrial();

        // Reset for next trial.
        response_background.hide();
        response_bar.hide();
        click_lock = false;

        // // Training phase
        // if (trialIndex < N/2) {
        //     yTrue = yTrain[trialIndex-1];

        //     // if they are wrong show feedback
        //     yTrainReported.push(yNow);
        //     feedback.attr({ y: 400 - yTrue * PPU, height: yTrue * PPU });
        //     feedback.show();
        //     feedback.animate({fill: "#666"}, 100, "<", function () {
        //         this.animate({fill: "#CCC"}, 100, ">");
        //     });

        //     // Move on to next trial if response is correct.
        //     if(Math.abs(yNow - yTrue) < 4) {
        //         clicked = true;
        //         feedback.hide();
        //         stimulusX.hide();
        //         stimulusY.hide();
        //         Mousetrap.resume();
        //     }
        // // Testing phase
        // } else if (trialIndex <= N) {
        //     clicked = true;
        //     $("#training-or-testing").html("Testing");
        //     yTest.push(yNow);
        //     feedback.hide();
        //     stimulusX.hide();
        //     stimulusY.hide();
        //     Mousetrap.resume();
        // }
    };
}

//
//
//
showPartner = function() {

    // Get partner's guess
    reqwest({
        url: "/node/" + my_node_id + "/received_infos",
        method: 'get',
        type: 'json',
        success: function (resp) {
            if (resp.infos.length === 0) {
                get_info();
            } else {
                r = resp.infos[0].contents;
                int_list = JSON.parse(r);
                $("#title").text("Partner connected");
                $(".instructions").text("Press enter to begin");
                enter_lock = false;
            }

    // Draw partner's background.
    partner_background = paper.rect(response_x_start, response_y_start+200, response_bg_width, response_bg_height-2*inset);
    partner_background.attr("stroke", "#CCCCCC");
    partner_background.attr("stroke-dasharray", "--");

    // Draw partner's guess.
    partner_bar = paper.rect(response_x_start, response_y_start-inset+200, response_bg_width, response_bg_height);
    partner_bar.attr("fill", "#0B486B");
    partner_bar.attr("stroke", "none");

}

$(document).keydown(function(e) {
    var code = e.keyCode || e.which;
    if (code == 13) {
        if (enter_lock === false) {
            enter_lock = true;

            drawUserInterface();
            // proceedToNextTrial();

            click_lock = false;
        }
    }
});
