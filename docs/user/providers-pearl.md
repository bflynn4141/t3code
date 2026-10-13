# Pearl

[Pearl](https://pearlresearch.ai) serves open models such as GLM-5.3, DeepSeek V4 Pro and
Gemma 4 on GPUs that also mine its coin, PRL, using the same math that answers your prompt.
Shucks shows an estimate of the PRL each Pearl reply mined.

## Connect

1. Install OpenCode (`npm install -g opencode-ai`). Shucks runs Pearl models through it.
2. Create a key at [platform.pearlresearch.ai](https://platform.pearlresearch.ai). Access is
   by waitlist for now.
3. In **Settings > Providers**, paste the key under **Pearl** and choose **Connect**.

Pearl's models then appear in the model picker under the Pearl instance. The key is stored
as a server secret. **Replace key** and **Disconnect** are in the same place.

## Reward estimates

After a Pearl reply finishes, its footer shows a glossy pearl with the estimated reward in grains (a grain is a
millionth of a PRL), its value in dollars, and how long the turn took. Hover or tap it for the breakdown: tokens,
cost, the math the turn caused, and the share of its cost the reward represents.

The estimate counts the matrix math your turn caused: about two operations per model
parameter in use, per token. Cached input is read back rather than recomputed, so it doesn't
count. That work is valued at the network's current block reward, hashrate and PRL price,
which T3 Code refreshes every five minutes.

It's an estimate, not a balance. Pearl pays block rewards to miners, and payouts to the
people sending prompts aren't live yet.
