from models import Alignment, AlignmentRow
from itertools import combinations, izip
import numpy as np
import scipy
import math
from collections import defaultdict
from operator import mul
from math import factorial


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
    
def log_pp_mat(A):
    ncol = A.shape[1]
    logPP = np.zeros((ncol, ncol))
    Acols = np.zeros((ncol,), dtype='O')
    
    for i in xrange(ncol):
        Acols[i] = A[:,i].tolist()
        
    for i in xrange(ncol):
        for j in xrange(i):
            logPP[i, j] = log_partition_prob(Acols[i], Acols[j])
        
    return logPP


    def log_partition_prob(Acoli, Acolj):    
        nkc = defaultdict(lambda : defaultdict(float))
        nc = defaultdict(float)
        for ai, aj in izip(Acoli,Acolj):
            nkc[ai][aj]+=1.
            nc[aj] += 1.

        nk = dict((k, sum(nkc[k].values())) for k in nkc)
        n = sum(nk.values())

        s1 = sum(logfact(nk[k]) - sum(logfact(nkc[k][c]) for c in nkc[k]) for k in nk)
        s2 = sum(logfact(nc[c]) for c in nc)
        s3 = logfact(n)

        return s1 + s2 - s3
        

# older stuff.
        

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
    


