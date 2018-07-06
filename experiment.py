"""Define an experiment to explore joint decision making."""

from dallinger.experiments import Experiment
from dallinger.models import Network, Node, Info
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast
from dallinger.nodes import Source
from random import randint
from random import choice
import json


class JointEstimation(Experiment):
    """An experiment for joint perception."""

    # set the desired number of dyads in each condition
    recruit_cooperative = 5
    recruit_competitive = 5
    recruit_neutral = 5

    # total participants desired
    recruit_all = (recruit_cooperative +
                   recruit_competitive +
                   recruit_neutral) * 2

    def __init__(self, session):
        """Call the same function in the super (see experiments.py in dallinger).

        A few properties are then overwritten. Finally, setup() is called.
        """
        super(JointEstimation, self).__init__(session)
        import models
        self.models = models
        self.experiment_repeats = 1
        self.setup()

        # set total participant recruitment
        self.num_participants = self.recruit_all
        self.initial_recruitment_size = self.num_participants
        self.completion_bonus_payment = 0.33
        self.accuracy_bonus_payment = 2.00
        self.total_test_trials = 15

    def create_network(self):
        """Create a new network."""
        return self.models.Paired()

    def create_node(self, participant, network):
        """Create a node for a participant."""

        # check how many participants are in each condition
        current_cooperative = Node.query.filter_by(type="cooperative").count()
        current_competitive = Node.query.filter_by(type="competitive").count()
        current_neutral = Node.query.filter_by(type="neutral").count()

        # figure out how many are still needed
        req_cooperative = self.recruit_cooperative * 2 - current_cooperative
        req_competitive = self.recruit_competitive * 2 - current_competitive
        req_neutral = self.recruit_neutral * 2 - current_neutral

        # identify which conditions still need folks
        available_conditions = []
        if req_cooperative > 0:
            available_conditions.append("cooperative")
        if req_competitive > 0:
            available_conditions.append("competitive")
        if req_neutral > 0:
            available_conditions.append("neutral")

        # randomly select among the three conditions and assign type
        assigned_type = choice(available_conditions)
        if assigned_type == "cooperative":
            return self.models.Cooperative(participant=participant,
                                           network=network)
        elif assigned_type == "competitive":
            return self.models.Competitive(participant=participant,
                                           network=network)
        elif assigned_type == "neutral":
            return self.models.Neutral(participant=participant,
                                       network=network)
        else:
            exit('Improper condition passed during participant node creation.')

    def setup(self):
        """Create networks. Add a source if the networks don't yet exist."""
        if not self.networks():

            # create practice networks with desired properties
            for _ in range(self.practice_repeats):
                network = self.create_network()
                network.role = "practice"
                self.session.add(network)
                self.models.ListSource(network=network)

            # create experiment network with desired properties
            for _ in range(self.experiment_repeats):
                network = self.create_network()
                network.role = "experiment"
                self.session.add(network)
                self.models.ListSource(network=network)

            # initialize the network
            self.session.commit()

    def bonus(self, participant):
        """Calculate a participant's bonus."""

        # Get only the "info" from target participant's nodes.
        all_nodes = participant.nodes()
        experiment_nodes = [n for n in all_nodes
                            if n.network.role == "experiment"]
        nested_infos = [n.infos() for n in experiment_nodes]
        flattened_infos = [info_item for info_list in nested_infos
                           for info_item in info_list]

        # Grab their final accuracy scores.
        score = [float(info.property3) for info
                 in flattened_infos]  # get the accuracy of the infos

        # If they timed out, give them no bonuses.
        if -9999999999999999999999999999 in score:
            bonus = 0.0

        # Otherwise, grant them appropriate bonuses
        else:
            score = [trial_bonus if trial_bonus > 0.0 else 0.0 for trial_bonus in score ]
            mean_accuracy = float(sum(score))/float(self.total_test_trials)
            bonus = round(min((self.accuracy_bonus_payment +
                               self.completion_bonus_payment),
                              max(0.0, ((mean_accuracy *
                                         self.accuracy_bonus_payment) +
                                        self.completion_bonus_payment))),
                          2)
        return bonus

    def submission_successful(self, participant):
        """Run when a participant submits successfully."""
        # If a participant submits but some of their nodes lack a partner,
        # then fail their nodes. This will also fail the vectors connected to
        # that node.
        for n in participant.nodes():
            if len(n.vectors()) < 2:
                n.fail()
