from models import Alignment, AlignmentRow
from itertools import combinations, izip
import numpy as np
import scipy
import math
from collections import defaultdict
from math import factorial
from numpy.random import permutation
from pylab import hist


def make_memoized_logfact():
    memo = {}
    def logfact(n):
        if memo.has_key(n):
            return memo[n]
        else:
            memo[n] = math.log(scipy.factorial(n))
            print "(memoized logfact(%d) = %f)" % (n, memo[n])
            return memo[n]
    
    return logfact

logfact = make_memoized_logfact()


def get_mat(alignment):
     
    rows = alignment.alignmentrow_set.all()
    A = np.chararray((rows.count(),alignment.length), 1)

    for row in rows.all():
        A[row.row_num-1] = list(row.sequence)
    return A
    

def find_nongaps(lcol, rcol):
    return np.logical_and(lcol != '-', rcol !='-')
        

def randomized_experiment_protocol_2(A, n_expts):
    print "saving A"
    A.tofile('A.save')
    nrow, ncol = A.shape
    randomized_logPPs = np.zeros((n_expts, ncol, ncol))
    logPP = np.zeros((ncol, ncol))

    print "precalculating col_nongaps and col."
    col_nongaps = np.zeros((ncol,), dtype='O')
    col = np.zeros((ncol,), dtype='O')
    for i in xrange(ncol):
        col[i] = A[:,i]
        col_nongaps[i] = col[i] != '-'

    def save(i):
        print "SAVING; col %d of %d completed." % (i, ncol)
        logPP.tofile('logPP.save')
        randomized_logPPs.tofile('randomized_logPPs.save')
    
    for j in xrange(ncol):
        for i in xrange(j):
            print "rcol %d vs. lcol %d:" % (j,i)
            pair_nongaps = np.logical_and(col_nongaps[i], col_nongaps[j])
            n_pair_nongaps = sum(pair_nongaps)
            if n_pair_nongaps == 0:
                logPP[i,j] = np.nan
                print "  no nongaps; skipping."
            else:
                lcol, rcol = col[i][pair_nongaps], col[j][pair_nongaps]
                lcol_as_list = lcol.tolist()
                logPP[i,j] = log_partition_prob(lcol_as_list, rcol.tolist())
                print "  stored logPP; running %d experiments." % n_expts
                for expt in xrange(n_expts):
                    randomized_rcol = rcol[permutation(n_pair_nongaps)]
                    randomized_logPPs[expt, i, j] = log_partition_prob(lcol_as_list, randomized_rcol.tolist())

        if j % 20 == 1:
            save(j)
    save(j)
    print "done."
    
    
def dist_hists(logPP, randomized_logPPs, nbins, i,j):

    random_hist = np.histogram(np.append(randomized_logPPs[:,i,j], logPP[i,j]), bins=nbins)
    random_hist_bins = random_hist[1]
    
    hist(randomized_logPPs[:,i,j], bins=random_hist_bins)
    hist(np.array([logPP[i,j]]), bins=random_hist_bins)
    

def load_protocol_2(n_expts, shape):
    nrow, ncol = shape
    A = np.fromfile('A.save', dtype='S1').reshape(shape)
    logPP = np.fromfile('logPP.save').reshape(ncol, ncol)
    randomized_logPPs = np.fromfile('randomized_logPPs.save').reshape(n_expts, ncol, ncol)
    return A, logPP, randomized_logPPs


def get_n_nongapped(A):
    nrow, ncol = A.shape
    n_nongapped = np.zeros((ncol, ncol),dtype='int')
    nongaps = A != '-'
    for j in xrange(ncol):
        rcol = nongaps[:,j]
        for i in xrange(j):
            lcol = nongaps[:,i]
            n_nongapped[i,j] = sum(np.logical_and(lcol, rcol))
    
    return n_nongapped

def analyze_protocol_2(A, logPP, randomized_logPPs, n_nongapped):

    nrow, ncol = A.shape
    min_nongapped_rows = nrow/10
    usable = np.logical_and(n_nongapped > min_nongapped_rows, np.logical_not(np.isnan(logPP)))

    means = np.mean(randomized_logPPs, axis=0)
    stds = np.std(randomized_logPPs, axis=0)
    
    assert means.shape == stds.shape == logPP.shape
    
    diffs = means - logPP           # expect logPP < mean
    diffs_over_std = diffs / stds
    
    diffs_over_std_iter = np.ndenumerate(diffs_over_std)
    diffs_over_std_list = [(val, pos) for pos, val in diffs_over_std_iter if usable[pos] and not np.isnan(val)  ]
    
    return means, stds, diffs, diffs_over_std, diffs_over_std_list

    
    
    


def log_partition_prob(lcol, rcol):    
        nkc, nc, nk = make_dicts(lcol, rcol)
        n = sum(nk.values())
        
        s1 = sum(logfact(nk[k]) - sum(logfact(nkc[k][c]) for c in nkc[k]) for k in nk)
        s2 = sum(logfact(nc[c]) for c    in nc)
        s3 = logfact(n)

        return s1 + s2 - s3


def make_dicts(lcol, rcol):
    nkc = defaultdict(lambda : defaultdict(float))
    nc = defaultdict(float)
    for cl, cr in izip(lcol, rcol):
        nkc[cl][cr]+=1.
        nc[cr] += 1.

    nk = dict((k, sum(nkc[k].values())) for k in nkc)
    return nkc, nc, nk


def apply_to_randomized_logPPs(randomized_logPPs, f):
    ncol = randomized_logPPs.shape[1]
    randomized_logPP_results = np.zeros(randomized_logPPs[0].shape)
    for j in xrange(ncol):
        for i in xrange(j):
            randomized_logPP_results[i,j] = f(randomized_logPPs[:,i,j])
            
    return randomized_logPP_results


    
def logPP_chebyshev_bound(logPP, randomized_logPPs, means, vars):

    alpha = np.abs(logPP - means)
    return vars / alpha ** 2


# 
# older stuff
#


def log_pp_mat(A):
    ncol = A.shape[1]
    logPP = np.zeros((ncol, ncol))
    Acols = make_cols(A)
    for j in xrange(ncol):
        for i in xrange(j):
            logPP[i, j] = log_partition_prob(Acols[i], Acols[j])
    return logPP


def make_cols(A):
    ncol = A.shape[1]
    Acols = np.zeros((ncol,), dtype='O')
    for i in xrange(ncol):
        Acols[i] = A[:,i].tolist()
    return Acols
    

def randomize(A):
    """ return a copy of A with the non-gap residues in each column permuted."""
    residue_locs = (A != '-')
    copy = A.copy()

    for i in xrange(A.shape[1]):
        perm = permutation(sum(residue_locs[:,i]))
        copy[:,i][residue_locs[:,i]] = A[:,i][residue_locs[:,i]][perm]
    return copy
    

def load_experiment_files(n_expts,shape):
    nrow, ncol = shape
    A = np.fromfile('A.save', dtype='S1').reshape(shape)
    randomized_As = np.fromfile('randomized_As.save', dtype='S1').reshape(n_expts, nrow, ncol)
    logPP = np.fromfile('logPP.save').reshape(ncol, ncol)
    randomized_logPPs = np.fromfile('randomized_logPPs.save').reshape(n_expts, ncol, ncol)
    
    return A, randomized_As, logPP, randomized_logPPs



    
def randomized_experiment(A, n_expts):

    randomized_As = np.zeros((n_expts,) + A.shape, dtype=A.dtype)
    randomized_logPPs = np.zeros((n_expts, A.shape[1], A.shape[1]))
    print "calculating log_pp_mat for real A"
    logPP = log_pp_mat(A)
    A.tofile('A.save')
    logPP.tofile('logPP.save')
        
    for i in xrange(n_expts):
        print "randomizing A (experiment %d)" % i
        randomized_A = randomize(A)
        randomized_As[i,:,:] = randomized_A
        print "calculating log_pp_mat for randomized A"
        randomized_logPPs[i,:,:] = log_pp_mat(randomized_A)
        print "saving..."
        randomized_As.tofile('randomized_As.save')
        randomized_logPPs.tofile('randomized_logPPs.save')

def rank_logPPs(logPP, randomized_logPPs):
    
    logPP_ranks = np.zeros(logPP.shape)
    for j in xrange(logPP.shape[0]):
        for i in xrange(j):
            logPP_ranks[i,j] = sum(logPP[i,j] < randomized_logPPs[:,i,j])

    return logPP_ranks


def mi_mat(A):
    ncol = A.shape[1]
    MI = np.zeros((ncol, ncol))
    for i, j in combinations(xrange(ncol),2):
        MI[i, j] = mi(A, i, j)

    return MI

def mis_list(MI):
    return [(v, np.unravel_index(i, shape)) for i,v in enumerate(MI.flat)]
    
def counts(A, i, j):
    Ai = A[:,i].tolist()
    Aj = A[:,j].tolist()
    AiAj = zip(Ai, Aj)
    return map(make_one_counts_dict, (AiAj, Ai, Aj))

def make_one_counts_dict(l):
    d = defaultdict(int)
    for k in l:
        d[k] += 1
    return d
    
def H(A, i):
    d = make_one_counts_dict(A[:,i].tolist())
    n = sum(d.values())
    return -sum((float(d[k])/n) * np.log2(float(d[k])/n) for k in d)

def filter_pred(pair, npair, leftchar, nleft, rightchar, nright):
    if pair[0] == '-' or pair[1] == '-':
        return False
    elif npair == 1:
        if nleft == 1 and nright == 1:
            return False
    else:
        return True  

def mi(A, i, j):
    n = A.shape[0]
    pair_ct, Ai_ct, Aj_ct = counts(A, i, j)
    pair_ct = dict((k,pair_ct[k]) for k in pair_ct if filter_pred(k, pair_ct[k], k[0], Ai_ct[k[0]], k[1], Aj_ct[k[1]]))
    pxy_over_pxpy = np.array([n * (float(nij) / (Ai_ct[t[0]] * Aj_ct[t[1]])) for t, nij in pair_ct.iteritems()])
    pxy = np.array(pair_ct.values())/float(n)
    return sum(pxy * np.log2(pxy_over_pxpy))

def print_pairs(A, i, j):
    AiAj_zipped = zip(A[:,i], A[:,j])
    AiAj_zipped.sort()
    for t in AiAj_zipped:
       print t[0] + ' : ' + t[1]
    


