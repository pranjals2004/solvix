import unittest

from main import ClusterDoubt, ClusterRequest, cluster, cluster_embeddings


class MisconceptionClusteringTests(unittest.TestCase):
    def test_small_topic_is_returned_as_unclustered_noise(self):
        ids = ["d1", "d2", "d3"]
        embeddings = [[0.0] * 384 for _ in ids]

        response = cluster_embeddings(ids, embeddings)

        self.assertEqual(response.clusters, [])
        self.assertEqual([item.cluster_id for item in response.assignments], [None, None, None])

    def test_cluster_endpoint_skips_model_loading_for_tiny_sample(self):
        response = cluster(ClusterRequest(doubts=[
            ClusterDoubt(id="d1", text="recursive base case"),
            ClusterDoubt(id="d2", text="termination condition"),
        ]))

        self.assertEqual(len(response.assignments), 2)
        self.assertTrue(all(item.cluster_id is None for item in response.assignments))


if __name__ == "__main__":
    unittest.main()
