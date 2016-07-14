"""Define a transmission-chain experiment that transmits functional forms."""

from wallace.experiments import Experiment
from wallace.models import Network, Node
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast


class FunctionLearning(Experiment):
    """A function-learning experiment."""

    def __init__(self, session):
        """Call the same function in the super (see experiments.py in wallace).

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

        self.index = self.network.size()
