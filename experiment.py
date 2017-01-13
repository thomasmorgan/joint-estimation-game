"""Define a transmission-chain experiment that transmits functional forms."""

from dallinger.experiments import Experiment
from dallinger.models import Network, Node, Info
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast
from dallinger.nodes import Source
from random import randint
import json


class FunctionLearning(Experiment):
    """A function-learning experiment."""

    def __init__(self, session):
        """Call the same function in the super (see experiments.py in dallinger).

        A few properties are then overwritten. Finally, setup() is called.
        """
        super(FunctionLearning, self).__init__(session)
        self.experiment_repeats = 1
        self.setup()

    def create_network(self):
        """Create a new network."""
        return Paired()

    def create_node(self, participant, network):
        """Create a new node."""
        return Indexed(participant=participant, network=network)

    def setup(self):
        """Create the networks and add a source if the networks don't already exist."""
        if not self.networks():
            for _ in range(self.practice_repeats):
                network = self.create_network()
                network.role = "practice"
                self.session.add(network)
                ListSource(network=network)
            for _ in range(self.experiment_repeats):
                network = self.create_network()
                network.role = "experiment"
                self.session.add(network)
                ListSource(network=network)
            self.session.commit()


class Paired(Network):
    """Node <-> Node; Node <-> Node; ...
    """

    __mapper_args__ = {"polymorphic_identity": "paired"}

    def add_node(self, node):
        """Node <-> Node; Node <-> Node; etc. """

        n_index = node.index
        if n_index % 2 == 1:
            partner_n_index = n_index + 1
        else:
            partner_n_index = n_index - 1

        try:
            partner_node = Indexed.query.filter_by(network_id=node.network_id, index=partner_n_index).one()
            node.connect(direction="both", whom=partner_node)

            # grab the source created for the network
            source = self.nodes(type=ListSource)[0]

            # connect the sources to both nodes and sends them both the same list
            source.connect(whom=[node, partner_node])
            source.transmit(what=source.new_list(), to_whom=[node, partner_node])

            # let both nodes receive the list that've been sent
            node.receive()
            partner_node.receive()

        except:
            pass


class Indexed(Node):
    """A node with an index"""

    __mapper_args__ = {"polymorphic_identity": "indexed"}

    @hybrid_property
    def index(self):
        """Convert property1 to index."""
        return int(self.property1)

    @index.setter
    def index(self, index):
        """Make index settable."""
        self.property1 = repr(index)

    @index.expression
    def index(self):
        """Make index queryable."""
        return cast(self.property1, Integer)

    def __init__(self, network, participant=None):
        """Give the node its index."""

        super(Indexed, self).__init__(network, participant)

        self.index = self.network.size(type=Indexed)


class ListSource(Source):
    """A source that generates lists of numbers randomly sampled from a uniform distribution for
    each pair in a paired network. These lists are then sent to each pair."""

    __mapper_args__ = {"polymorphic_identity": "listsource"}

    def new_list(self):
        """Generate a list of numbers randomly sampled from a uniform distribution."""

        # create list container and specify number of trials
        list_to_add = []
        list_length = 20

        # iterate over our desired number of trials to make a new list of the appropriate length
        for new_item in range(list_length):
            list_to_add.append(randint(1, 100))

        # ship our list as a string (which we'll then reconstitute as a list upon reading)
        return Info(origin=self, contents=json.dumps(list_to_add))
