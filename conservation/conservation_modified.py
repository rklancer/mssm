################################################################################
# Adapted from the following file on 11/15/09 by Richard Klancer
#
# score_conservation.py - Copyright Tony Capra 2007 - Last Update: 06/21/09
#
# 06/21/09 - seq specific output now compatible with ConCavity
# 06/21/09 - numarray only included when vn_entropy is used
# 08/15/08 - added property_relative_entropy scoring method
# 08/15/08 - added equal sequence length check
# 01/07/08 - added z-score normalization option (-n)
# 01/07/08 - added seq. specific output option (-a)
# 11/30/07 - read_scoring_matrix now returns list rather than array.
# 11/30/07 - added window lambda command line option (-b)
# 07/05/07 - fixed gap penalty cutoff (<=) and error message
# 06/26/07 - fixed read_clustal_align bug
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
#
# -----------------------------------------------------------------------------
# This program supports the paper: Capra JA and Singh M. 
# Predicting functionally important residues from sequence
# conservation. Bioinformatics. 23(15): 1875-1882, 2007.
# Please cite this paper if you use this code.
#

# (...)
# 
# 
# All scoring functions follow the same prototype:
#
# def score(col, sim_matrix, bg_disr, seq_weights, gap_penalty=1):
#
# - col: the column to be scored.
# 
# - sim_matrix: the similarity (scoring) matrix to be used. Not all 
# methods will use this parameter. 
# 
# - bg_distr: a list containing an amino acid probability distribution. Not
# all methods use this parameter. The default is the blosum62 background, but
# other distributions can be given. 
#
# - seq_weights: an array of floats that is used to weight the contribution
# of each seqeuence. If the len(seq_weights) != len(col), then every sequence 
# gets a weight of one.
#
# - gap_penalty: a binary variable: 0 for no gap penalty and 1
# for gap penalty. The default is to use a penalty. The gap penalty used is
# the score times the fraction of non-gap positions in the column.
#
#
# For a window score of any of above methods use the window_score method to 
# transform the individual column scores. 
#
################################################################################

import math



PSEUDOCOUNT = .0000001

amino_acids = ['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V', '-']

#iupac_alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z", "X", "*", "-"] 

# dictionary to map from amino acid to its row/column in a similarity matrix
aa_to_index = {}
for i, aa in enumerate(amino_acids):
    aa_to_index[aa] = i


def get_column(col_num, alignment):
    """Return the col_num column of alignment as a list."""
    col = []
    for seq in alignment:
        if col_num < len(seq): 
            col.append(seq[col_num])

    return col



def calculate_sequence_weights(msa):
    """ Calculate the sequence weights using the Henikoff '94 method
    for the given msa. """

    # note: msa = alignment = list of sequences  (RPK)

    seq_weights = [0.] * len(msa)
    
    for i in range(len(msa[0])):
        freq_counts = [0] * len(amino_acids)

        col = []
        for j in range(len(msa)):
            if msa[j][i] != '-': # ignore gaps
                freq_counts[aa_to_index[msa[j][i]]] += 1

        num_observed_types = 0
        for j in range(len(freq_counts)):
            if freq_counts[j] > 0: num_observed_types +=1

        for j in range(len(msa)):
            d = freq_counts[aa_to_index[msa[j][i]]] * num_observed_types
            if d > 0:
                seq_weights[j] += 1. / d

    for w in range(len(seq_weights)):
        seq_weights[w] /= len(msa[0])

    return seq_weights


def weighted_freq_count_pseudocount(col, seq_weights, pc_amount):
    """ Return the weighted frequency count for a column--with pseudocount."""

    # if the weights do not match, use equal weight
    if len(seq_weights) != len(col):
        seq_weights = [1.] * len(col)

    aa_num = 0
    freq_counts = len(amino_acids)*[pc_amount] # in order defined by amino_acids

    for aa in amino_acids:
        for j in range(len(col)):
            if col[j] == aa:
                freq_counts[aa_num] += 1 * seq_weights[j]

        aa_num += 1

    for j in range(len(freq_counts)):
        freq_counts[j] = freq_counts[j] / (sum(seq_weights) + len(amino_acids) * pc_amount)

    return freq_counts


def weighted_gap_penalty(col, seq_weights):
    """ Calculate the simple gap penalty multiplier for the column. If the 
    sequences are weighted, the gaps, when penalized, are weighted 
    accordingly. """

    # if the weights do not match, use equal weight
    if len(seq_weights) != len(col):
        seq_weights = [1.] * len(col)

    gap_sum = 0.
    for i in range(len(col)):
        if col[i] == '-':
            gap_sum += seq_weights[i]

    return 1 - (gap_sum / sum(seq_weights))


def gap_percentage(col):
    """Return the percentage of gaps in col."""
    num_gaps = 0.

    for aa in col:
        if aa == '-': num_gaps += 1

    return num_gaps / len(col)


def js_divergence(col, sim_matrix, bg_distr, seq_weights, gap_penalty=1):
    """ Return the Jensen-Shannon Divergence for the column with the background
    distribution bg_distr. sim_matrix is ignored. JSD is the default method."""

    distr = bg_distr[:]

    fc = weighted_freq_count_pseudocount(col, seq_weights, PSEUDOCOUNT)

    # if background distrubtion lacks a gap count, remove fc gap count
    if len(distr) == 20: 
        new_fc = fc[:-1]
        s = sum(new_fc)
        for i in range(len(new_fc)):
            new_fc[i] = new_fc[i] / s
        fc = new_fc

    if len(fc) != len(distr): return -1

    # make r distriubtion
    r = []
    for i in range(len(fc)):
        r.append(.5 * fc[i] + .5 * distr[i])

    d = 0.
    for i in range(len(fc)):
        if r[i] != 0.0:
            if fc[i] == 0.0:
                d += distr[i] * math.log(distr[i]/r[i], 2)
            elif distr[i] == 0.0:
                d += fc[i] * math.log(fc[i]/r[i], 2) 
            else:
                d += fc[i] * math.log(fc[i]/r[i], 2) + distr[i] * math.log(distr[i]/r[i], 2)

    # d /= 2 * math.log(len(fc))
    d /= 2

    if gap_penalty == 1: 
        return d * weighted_gap_penalty(col, seq_weights)
    else: 
        return d


    def window_score(scores, window_len, lam=.5):
        """ This function takes a list of scores and a length and transforms them 
        so that each position is a weighted average of the surrounding positions. 
        Positions with scores less than zero are not changed and are ignored in the 
        calculation. Here window_len is interpreted to mean window_len residues on 
        either side of the current residue. """

        w_scores = scores[:]

        for i in range(window_len, len(scores) - window_len):
            if scores[i] < 0: 
                continue

            sum = 0.
            num_terms = 0.
            for j in range(i - window_len, i + window_len + 1):
                if i != j and scores[j] >= 0:
                    num_terms += 1
                    sum += scores[j]

            if num_terms > 0:
                w_scores[i] = (1 - lam) * (sum / num_terms) + lam * scores[i]

        return w_scores


    def calc_z_scores(scores, score_cutoff):
        """Calculates the z-scores for a set of scores. Scores below
        score_cutoff are not included."""

        average = 0.
        std_dev = 0.
        z_scores = []
        num_scores = 0

        for s in scores:
            if s > score_cutoff:
                average += s
                num_scores += 1
        if num_scores != 0:
            average /= num_scores

        for s in scores:
            if s > score_cutoff:
                std_dev += ((s - average)**2) / num_scores
        std_dev = math.sqrt(std_dev)

        for s in scores:
            if s > score_cutoff and std_dev != 0:
                z_scores.append((s-average)/std_dev)
            else:
                z_scores.append(-1000.0)

        return z_scores



######################## RPK

# some default values and notes toward usage

# from 'blosum62.distribution' file supplied with conservation_code.py

    # This is the BLOSUM62 distribution. It is the default background distribution.
    # The amino acid order is 'A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'

blosum62_bkgd = [0.078, 0.051, 0.041, 0.052, 0.024, 0.034, 0.059, 0.083, 0.025, 0.062, 0.092, 0.056, 0.024, 0.044, 0.043, 0.059, 0.055, 0.014, 0.034, 0.072]

window_size = 3
win_lam = .5
pc_amount = PSEUDOCOUNT
sim_matrix = None           # value is ignored by js_divergence, so don't need to specify.

seq_weights = calculate_sequence_weights(alignment)



# calculate scores
scores = []
for i in range(len(alignment[0])):
    col = get_column(i, alignment)

    if len(col) == len(alignment):
        if gap_percentage(col) <= gap_cutoff:
            scores.append(scoring_function(col, s_matrix, bg_distribution, seq_weights, use_gap_penalty))
        else:
            scores.append(-1000.)

if window_size > 0:
    scores = window_score(scores, window_size, win_lam)

# if we want to use this...
if normalize_scores:
    scores = calc_z_scores(scores, -999)



######################## end RPK
