lock = false;

// Add new (not yet released) code from Dallinger.
Dallinger.submitQuestionnaire = function (name) {
  var formSerialized = $('form').serializeArray();
  var formDict = {};
  var deferred = $.Deferred();

  formSerialized.forEach(function (field) {
    formDict[field.name] = field.value;
  });

  reqwest({
    method: 'post',
    url: '/question/' + participantId,
    data: {
      question: name || 'questionnaire',
      number: 1,
      response: JSON.stringify(formDict)
    },
    type: 'json',
    success: function (resp) {
      deferred.resolve();
    },
    error: function (err) {
      deferred.reject();
      var errorResponse = JSON.parse(err.response);
      $('body').html(errorResponse.html);
    }
  });

  return deferred;
};

// Cribbed from Dallinger Griduniverse repo:
// https://github.com/Dallinger/Griduniverse/blob/master/dlgr/griduniverse/static/scripts/questionnaire.js
$(document).ready(function () {
  // Submit the questionnaire.
  $("#submit-questionnaire").click(function() {
    var $elements = [$("form :input"), $(this)],
        questionSubmission = Dallinger.submitQuestionnaire("questionnaire");
        console.log("Submitting questionnaire.");
    questionSubmission.done(function()
        {
          go_to_page('debriefing');
        });
  });
});
