lock = false;

$(document).ready( function() {

  // Allow to proceed only ONCE.
  if (lock===false){

      // Finish the experiment.
      $("#finish-experiment").click(function() {

        // Prevent multiple submission clicks.
        lock = true;
        $(document).off('click');

        // Submit the HIT.
        dallinger.submitAssignment();
      });
  };
});
