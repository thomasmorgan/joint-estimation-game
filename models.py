"""Define additional classes required for the Joint Estimation Experiment."""

from dallinger.experiments import Experiment
from dallinger.models import Network, Node, Info
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast
from dallinger.nodes import Source
from random import randint
import json

class Paired(Network):
    """Node <-> Node; Node <-> Node; ...
    """

    __mapper_args__ = {"polymorphic_identity": "paired"}

    def add_node(self, node):
        """Node <-> Node; Node <-> Node; etc. """

        # get a list of all potential partners
        all_nodes = self.nodes(type=type(node))
        other_nodes = [n for n in all_nodes if n is not node]
        available_nodes = [n for n in other_nodes if not any(n.vectors)]

        # if there are available nodes
        if available_nodes:
            import random
            # pick a partner at random
            partner = random.choice(available_nodes)

            # connect to them
            node.connect(direction="both", whom=partner)

            # grab the source created for the network
            source = self.nodes(type=ListSource)[0]

            # connect the sources to both nodes and sends them both the same list
            source.connect(whom=[node, partner_node])
            source.transmit(what=source.new_list(), to_whom=[node, partner_node])

            # let both nodes receive the list that've been sent
            node.receive()
            partner_node.receive()

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

    @hybrid_property
    def accuracy(self):
        """Convert property3 to accuracy."""
        return int(self.property3)

    @accuracy.setter
    def accuracy(self, index):
        """Make accuracy settable."""
        self.property3 = repr(accuracy)

    @accuracy.expression
    def accuracy(self):
        """Make index queryable."""
        return cast(self.property3, Integer)

class ListSource(Source):
    """A source that generates lists of numbers randomly sampled from a uniform distribution for
    each pair in a paired network. These lists are then sent to each pair."""

    __mapper_args__ = {"polymorphic_identity": "listsource"}

    def new_list(self):
        """Generate a list of numbers randomly sampled from a uniform distribution."""

        # create list container and specify number of trials
        list_to_add = []
        list_length = 100

        # iterate over our desired number of trials to make a new list of the appropriate length
        for new_item in range(list_length):
            list_to_add.append(randint(1, 100))

        # ship our list as a string (which we'll then reconstitute as a list upon reading)
        return Info(origin=self, contents=json.dumps(list_to_add))
