const txml = require('txml');

module.exports = (xml) => {
    const dom = txml.parse(xml);
    const d = txml.simplifyLostLess(dom[0].children);

    return {
        cache_key: d.cacheKey[0],
        hotels: d.HotelList[0].HotelSummary.map(summary => {
            return {
                hotel_id: summary.hotelId[0],
                name: summary.name[0],
                rooms: summary.RoomRateDetailsList[0].RoomRateDetails.map(room => {
                    return {
                        rates: room.RateInfos[0].RateInfo.map(rate => {
                            return {
                                currency: rate.ChargeableRateInfo[0]._attributes.currencyCode,
                                non_refundable: rate.nonRefundable == 'true',
                                price: parseFloat(rate.ChargeableRateInfo[0]._attributes.total),
                            };
                        })
                    };
                })
            };
        }),
        session_id: d.customerSessionId[0],
    };
};