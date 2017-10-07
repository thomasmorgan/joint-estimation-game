"""Define an experiment to explore joint decision making."""

from dallinger.experiments import Experiment
from dallinger.models import Network, Node, Info
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast
from dallinger.nodes import Source
from random import randint
import json


class JointEstimation(Experiment):
    """An experiment for joint perception."""

    def __init__(self, session):
        """Call the same function in the super (see experiments.py in dallinger).

        A few properties are then overwritten. Finally, setup() is called.
        """
        super(JointEstimation, self).__init__(session)
        import models
        self.models = models
        self.experiment_repeats = 1
        self.setup()
        self.num_participants = 30  # Remember: These are dyads.
        self.initial_recruitment_size = 2
        self.completion_bonus_payment = .33
        self.accuracy_bonus_payment = 2
        self.total_test_trials = 15

    def create_network(self):
        """Create a new network."""
        return self.models.Paired()

    def create_node(self, participant, network):
        """Create a new node."""
        return self.models.Indexed(participant=participant, network=network)

    def setup(self):
        """Create networks. Add a source if the networks don't yet exist."""
        if not self.networks():
            for _ in range(self.practice_repeats):
                network = self.create_network()
                network.role = "practice"
                self.session.add(network)
                self.models.ListSource(network=network)
            for _ in range(self.experiment_repeats):
                network = self.create_network()
                network.role = "experiment"
                self.session.add(network)
                self.models.ListSource(network=network)
            self.session.commit()

    def bonus(self, participant):
        """Calculate a participant's bonus."""
        nodes = participant.nodes()
        nets = Network.query.filter_by(role="experiment").all()
        net_ids = [net.id for net in nets]
        nodes = [node for node in nodes if node.network_id in net_ids]

        # Specify bonus for accuracy.
        score = [node.score for node in nodes]
        score = filter(lambda a: a != 0, score)
        score = score + [0] * (self.total_trials - len(score))
        accuracy = float(sum(score))/float(self.total_test_trials)

        # Specify a bonus for completion.
        if accuracy < 0:
            self.completion_bonus_payment = 0

        # Calculate actual bonus.
        bonus = round(max(0.0, ((accuracy * self.accuracy_bonus_payment) + self.completion_bonus_payment)), 2)
        return bonus
