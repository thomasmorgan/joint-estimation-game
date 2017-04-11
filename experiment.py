"""Define a transmission-chain experiment that transmits functional forms."""

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

    def create_network(self):
        """Create a new network."""
        return self.models.Paired()

    def create_node(self, participant, network):
        """Create a new node."""
        return self.models.Indexed(participant=participant, network=network)

    def setup(self):
        """Create the networks, and add a source if the networks don't already exist."""
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

