export default function ProductDrilldown({ productId, totals, rowCount, onClose }) {
  if (!productId || !totals) return null;
  return (
    <section className="panel-card glass-card" data-testid="product-drilldown">
      <div className="panel-heading">
        <div><span className="section-kicker">PRODUCT DETAIL</span><h2>商品 {productId} 详情</h2></div>
        <button className="text-button" onClick={onClose}>返回分析列表</button>
      </div>
      <div className="metrics-grid" style={{ marginTop: 10 }}>
        <div className="metric-card"><strong>{totals.impressions.toLocaleString()}</strong><span>曝光量</span></div>
        <div className="metric-card"><strong>{totals.clicks.toLocaleString()}</strong><span>点击量</span></div>
        <div className="metric-card"><strong>{totals.paid.toLocaleString()}</strong><span>支付件数</span></div>
        <div className="metric-card"><strong>¥{totals.salesAmount.toLocaleString()}</strong><span>销售额</span></div>
      </div>
      <p className="panel-help">已按当前筛选日期汇总 {rowCount} 条明细，可继续在下方查看异常与趋势。</p>
    </section>
  );
}
