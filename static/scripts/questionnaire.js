lock = false;

// Add new (not yet released) code from Dallinger.
dallinger.submitQuestionnaire = function (name) {
  var formSerialized = $("form").serializeArray(),
      formDict = {},
      deferred = $.Deferred();

  formSerialized.forEach(function (field) {
      formDict[field.name] = field.value;
  });

  reqwest({
    method: "post",
    url: "/question/" + dallinger.identity.participantId,
    data: {
      question: name || "questionnaire",
      number: 1,
      response: JSON.stringify(formDict),
    },
    type: "json",
    success: function (resp) {
      deferred.resolve();
    },
    error: function (err) {
      deferred.reject();
      var errorResponse = JSON.parse(err.response);
      $("body").html(errorResponse.html);
    }
  });

  return deferred;
};


// Cribbed from Dallinger Griduniverse repo:
// https://github.com/Dallinger/Griduniverse/blob/master/dlgr/griduniverse/static/scripts/questionnaire.js
$(document).ready( function() {

  // Submit the questionnaire ONLY if we haven't clicked yet.
  if (lock===false){
      $("#submit-questionnaire").click(function() {

        // Prevent multiple submission clicks.
        lock = true;
        $(document).off('click');

        // Allow the form to submit.
        var $elements = [$("form :input"), $(this)],
            questionSubmission = dallinger.submitQuestionnaire("questionnaire");
            console.log("Submitting questionnaire.");

        // Submit questionnaire.
        questionSubmission.done(function()
            {
              dallinger.goToPage('debriefing');
            });
    });
  }
});
