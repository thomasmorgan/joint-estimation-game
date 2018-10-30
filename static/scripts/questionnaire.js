lock = false;

// // Add new (not yet released) code from Dallinger.
// dallinger.submitQuestionnaire = function (name) {
//   var formSerialized = $("form").serializeArray(),
//       formDict = {},
//       deferred = $.Deferred();
//
//   formSerialized.forEach(function (field) {
//       formDict[field.name] = field.value;
//   });
//
//   reqwest({
//     method: "post",
//     url: "/question/" + dallinger.identity.participantId,
//     data: {
//       question: name || "questionnaire",
//       number: 1,
//       response: JSON.stringify(formDict),
//     },
//     type: "json",
//     success: function (resp) {
//       deferred.resolve();
//     },
//     error: function (err) {
//       deferred.reject();
//       var errorResponse = JSON.parse(err.response);
//       $("body").html(errorResponse.html);
//     }
//   });
//
//   return deferred;
// };

$(document).ready( function() {

  // // Submit the questionnaire ONLY if we haven't clicked yet.
  // if (lock===false){
  //     $("#submit-questionnaire").click(function() {
  //         // Prevent multiple submission clicks.
  //         lock = true;
  //         $(document).off('click');
  //
  //         // submit questionnaire
  //         dallinger.submitQuestionnaire("questionnaire");
  //       });

  // Submit the questionnaire.
  $("#submit-questionnaire").click(function() {
    console.log("Submitting questionnaire.");
    var $elements = [$("form :input"), $(this)],
        questionSubmission = dallinger.submitQuestionnaire("questionnaire");

    spinner.freeze($elements);
    questionSubmission.done(dallinger.submitAssignment);
    questionSubmission.always(function () {
      spinner.unfreeze();
    });


      // $("#submit-questionnaire").click(function() {
      //

      //
      //   // Allow the form to submit.
      //   var $elements = [$("form :input"), $(this)],
      //       questionSubmission = dallinger.submitQuestionnaire("questionnaire");
      //       console.log("Submitting questionnaire.");

        // // Submit questionnaire.
        // questionSubmission.done(function()
        //     {
        //       dallinger.goToPage('debriefing');
        //     });
  });
});
