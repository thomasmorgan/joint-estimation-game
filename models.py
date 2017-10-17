"""Define additional classes required for the Joint Estimation Experiment."""

from dallinger.models import Network, Node, Info
from sqlalchemy import Integer
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql.expression import cast
from dallinger.nodes import Source
from random import choice
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
        available_nodes = [n for n in other_nodes if not any(n.vectors(failed="all"))]

        # if there are available nodes
        if available_nodes:

            # pick a partner at random
            partner_node = choice(available_nodes)

            # connect to them
            node.connect(direction="both", whom=partner_node)

            # grab the source created for the network
            source = self.nodes(type=ListSource)[0]

            # connect the sources to both nodes and sends them both the same list
            source.connect(whom=[node, partner_node])
            source.transmit(what=source.new_list(), to_whom=[node, partner_node])

            # let both nodes receive the list that've been sent
            node.receive()
            partner_node.receive()


class Indexed(Node):
    """A node with an accuracy"""

    __mapper_args__ = {"polymorphic_identity": "indexed"}

    @hybrid_property
    def accuracy(self):
        """Convert property3 to accuracy."""
        return int(self.property3)

    @accuracy.setter
    def accuracy(self, accuracy):
        """Make accuracy settable."""
        self.property3 = repr(accuracy)

    @accuracy.expression
    def accuracy(self):
        """Make index queryable."""
        return cast(self.property3, Integer)


class ListSource(Source):
    """A source that generates lists of numbers randomly sampled from a uniform
    distribution for each pair in a paired network. These lists are then sent
    to each pair."""

    __mapper_args__ = {"polymorphic_identity": "listsource"}

    def new_list(self):
        """Generate a list of numbers randomly sampled from a uniform distribution."""

        max_number = 100
        list_length = 100
        number_list = [choice(range(max_number)) + 1 for _ in range(list_length)]

        # ship our list as a string (which we'll then reconstitute as a list upon reading)
        return Info(origin=self, contents=json.dumps(number_list))
