"""Define additional classes required for the Joint Estimation Experiment."""

from dallinger.models import Network, Node, Info
from dallinger.nodes import Source
from random import choice
import json


class Paired(Network):
    """Node <-> Node; Node <-> Node; ...
    """

    __mapper_args__ = {"polymorphic_identity": "paired"}

    # link nodes together only if they're in the same condition
    def add_node(self, node):
        """Node <-> Node; Node <-> Node; etc. """

        # get a list of all potential partners by condition
        available_nodes = [
            n for n in Node.query.filter_by(type=node.type, failed=False)
            if n is not node and
            not n.neighbors(direction="either")
        ]

        # if there are available nodes
        if available_nodes:

            # pick a partner at random
            partner_node = choice(available_nodes)

            # connect to them
            node.connect(direction="both", whom=partner_node)

            # grab the source created for the network
            source = self.nodes(type=ListSource)[0]

            # connect the sources to both nodes and sends both the same list
            source.connect(whom=[node, partner_node])
            source.transmit(what=source.new_list(),
                            to_whom=[node, partner_node])

            # let both nodes receive the list that've been sent
            node.receive()
            partner_node.receive()


class Indexed(Node):
    """A node with an accuracy"""

    __mapper_args__ = {"polymorphic_identity": "indexed"}


class ListSource(Source):
    """A source that generates lists of numbers randomly sampled from a uniform
    distribution for each pair in a paired network. These lists are then sent
    to each pair."""

    __mapper_args__ = {"polymorphic_identity": "listsource"}

    def new_list(self):
        """Generate a list of numbers randomly sampled from a
        uniform distribution."""

        max_number = 100
        list_length = 100
        num_competitors = 3
        stimulus_list = [[choice(range(max_number)) + 1
                          for _ in range(list_length)]
                         for competitor in range(num_competitors)]
        chosen_list = [choice(range(num_competitors))
                       for _ in range(list_length)]
        number_list = [stimulus_list, chosen_list]

        # ship our list as a string (which we'll reconstitute as a list later)
        return Info(origin=self, contents=json.dumps(number_list))


class Cooperative(Node):
    """Participant in the cooperative condition"""

    __mapper_args__ = {"polymorphic_identity": "cooperative"}


class Competitive(Node):
    """Participant in the competitive condition"""

    __mapper_args__ = {"polymorphic_identity": "competitive"}


class Neutral(Node):
    """Participant in the neutral condition"""

    __mapper_args__ = {"polymorphic_identity": "neutral"}
