import pandas as pd
import json

def compute_pareto_front(candidates: list[dict]) -> list[dict]:
    """
    Identifies which candidates are on the Pareto front.
    A candidate is on the Pareto front if no other candidate is strictly better on all three scores at once.
    Here 'better' means higher normalized binding (or lower vina_score), higher bbb_probability, higher qed.
    """
    if not candidates:
        return []

    df = pd.DataFrame(candidates)
    
    if 'vina_score' not in df.columns or len(df) == 0:
        return candidates

    # Vina score: more negative = better
    # For Pareto comparisons, we can just use the negative of vina_score, so higher is better
    df['neg_vina'] = -df['vina_score']
    
    pareto_flags = []
    
    for i, row1 in df.iterrows():
        is_pareto = True
        for j, row2 in df.iterrows():
            if i == j:
                continue
            
            # Check if row2 dominates row1
            better_or_eq_vina = row2['neg_vina'] >= row1['neg_vina']
            better_or_eq_bbb = row2['bbb_probability'] >= row1['bbb_probability']
            better_or_eq_qed = row2['qed'] >= row1['qed']
            
            strictly_better_vina = row2['neg_vina'] > row1['neg_vina']
            strictly_better_bbb = row2['bbb_probability'] > row1['bbb_probability']
            strictly_better_qed = row2['qed'] > row1['qed']
            
            # If row2 is >= in all, and > in at least one, row1 is dominated
            if (better_or_eq_vina and better_or_eq_bbb and better_or_eq_qed) and \
               (strictly_better_vina or strictly_better_bbb or strictly_better_qed):
                is_pareto = False
                break
                
        pareto_flags.append(is_pareto)
        
    df['on_pareto_front'] = pareto_flags
    df = df.drop(columns=['neg_vina'])
    
    return df.to_dict('records')

if __name__ == "__main__":
    # Example usage / test
    sample_data = [
        {"candidate_code": "OV-0001", "vina_score": -11.09, "bbb_probability": 0.81, "qed": 0.74},
        {"candidate_code": "OV-0005", "vina_score": -9.85,  "bbb_probability": 0.72, "qed": 0.55},
        {"candidate_code": "OV-0007", "vina_score": -10.81, "bbb_probability": 0.65, "qed": 0.48},
    ]
    
    results = compute_pareto_front(sample_data)
    print(json.dumps(results, indent=2))
